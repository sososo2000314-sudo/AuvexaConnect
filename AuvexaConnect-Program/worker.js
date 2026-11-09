const enc = new TextEncoder();
const dec = new TextDecoder();
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const json = (obj, status=200, extra={}) => new Response(JSON.stringify(obj), {
 status, headers: {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...extra}
});
const now = () => Math.floor(Date.now()/1000);
const id = () => crypto.randomUUID();
const cookie = (v, age=SESSION_SECONDS) => `auvexa_session=${v}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${age}`;
const b64 = b => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
async function hashPassword(password, salt) {
 const key = await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
 const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt:enc.encode(salt),iterations:210000,hash:"SHA-256"},key,256);
 return `${salt}.${b64(bits)}`;
}
async function verifyPassword(password, stored) {
 const [salt, expected] = String(stored).split(".");
 if (!salt || !expected) return false;
 const actual = await hashPassword(password,salt);
 return actual === stored;
}
async function digest(s) {
 const h=await crypto.subtle.digest("SHA-256",enc.encode(s));
 return [...new Uint8Array(h)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
async function sign(payload, secret) {
 const key=await crypto.subtle.importKey("raw",enc.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 return b64(await crypto.subtle.sign("HMAC",key,enc.encode(payload)));
}
async function currentUser(req, env) {
 const raw=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("auvexa_session="))?.slice(15);
 if(!raw) return null;
 const row=await env.DB.prepare("SELECT users.id,users.email,users.display_name,users.handle,users.bio,sessions.expires_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token_hash=?").bind(await digest(raw)).first();
 if(!row || row.expires_at<now()) return null;
 return row;
}
async function body(req) { try{return await req.json()}catch{return {}} }
function safeUser(u){return {id:u.id,email:u.email,display_name:u.display_name,handle:u.handle,bio:u.bio||""}}
async function adminOK(req, env) {
 if(!env.ADMIN_PASSWORD || !env.SESSION_SECRET) return false;
 const token=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("auvexa_admin="))?.slice(13);
 if(!token) return false;
 const [payload,sig]=token.split(".");
 if(!payload||!sig||await sign(payload,env.SESSION_SECRET)!==sig) return false;
 try {const d=JSON.parse(dec.decode(Uint8Array.from(atob(payload.replace(/-/g,"+").replace(/_/g,"/")),c=>c.charCodeAt(0))));return d.role==="admin"&&d.exp>now()}catch{return false}
}
export default {
 async fetch(req,env) {
  const u=new URL(req.url), p=u.pathname, method=req.method;
  if(p.startsWith("/api/")) {
   if(!env.DB) return json({ok:false,error:"D1データベースが未接続です。wrangler.tomlを設定してください。"},503);
   if(p==="/api/register"&&method==="POST"){
    const b=await body(req), email=String(b.email||"").trim().toLowerCase(), password=String(b.password||""), name=String(b.name||"").trim();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<10||name.length<1||name.length>40) return json({ok:false,error:"メールアドレス、名前、10文字以上のパスワードを確認してください。"},400);
    const handle=(String(b.handle||"user").toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,20)||"user")+"_"+crypto.randomUUID().slice(0,5);
    const uid=id(), salt=b64(crypto.getRandomValues(new Uint8Array(16))), ph=await hashPassword(password,salt);
    try{await env.DB.prepare("INSERT INTO users(id,email,display_name,handle,password_hash,created_at) VALUES(?,?,?,?,?,?)").bind(uid,email,name,handle,ph,now()).run()}catch{return json({ok:false,error:"このメールアドレスは登録済みの可能性があります。"},409)}
    const token=b64(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await digest(token),uid,now()+SESSION_SECONDS).run();
    return json({ok:true,user:{id:uid,email,display_name:name,handle,bio:""}},201,{"Set-Cookie":cookie(token)});
   }
   if(p==="/api/login"&&method==="POST"){
    const b=await body(req), email=String(b.email||"").trim().toLowerCase(), password=String(b.password||"");
    const user=await env.DB.prepare("SELECT * FROM users WHERE email=?").bind(email).first();
    if(!user||!await verifyPassword(password,user.password_hash)) return json({ok:false,error:"メールアドレスまたはパスワードが違います。"},401);
    const token=b64(crypto.getRandomValues(new Uint8Array(32)));
    await env.DB.prepare("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)").bind(await digest(token),user.id,now()+SESSION_SECONDS).run();
    return json({ok:true,user:safeUser(user)},200,{"Set-Cookie":cookie(token)});
   }
   if(p==="/api/logout"&&method==="POST"){
    const me=await currentUser(req,env); const raw=(req.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("auvexa_session="))?.slice(15);
    if(raw) await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?").bind(await digest(raw)).run();
    return json({ok:true},200,{"Set-Cookie":cookie("",0)});
   }
   const me=await currentUser(req,env);
   if(p==="/api/me"&&method==="GET") return me?json({ok:true,user:safeUser(me)}):json({ok:false,user:null},401);
   if(p==="/api/profile"&&method==="PATCH"){
    if(!me)return json({ok:false,error:"ログインしてください。"},401);
    const b=await body(req), name=String(b.display_name||"").trim(), bio=String(b.bio||"").slice(0,500);
    if(!name||name.length>40)return json({ok:false,error:"名前は1〜40文字で入力してください。"},400);
    await env.DB.prepare("UPDATE users SET display_name=?,bio=? WHERE id=?").bind(name,bio,me.id).run();
    return json({ok:true});
   }
   if(p==="/api/posts"&&method==="GET"){
    const rows=await env.DB.prepare("SELECT posts.id,posts.kind,posts.title,posts.body,posts.created_at,users.id AS user_id,users.display_name,users.handle,(SELECT COUNT(*) FROM likes WHERE likes.post_id=posts.id) AS likes,(SELECT COUNT(*) FROM comments WHERE comments.post_id=posts.id) AS comments FROM posts JOIN users ON users.id=posts.user_id ORDER BY posts.created_at DESC LIMIT 50").all();
    return json({ok:true,posts:rows.results||[]});
   }
   if(p==="/api/posts"&&method==="POST"){
    if(!me)return json({ok:false,error:"投稿にはログインが必要です。"},401);
    const b=await body(req), kind=["text","short","video"].includes(b.kind)?b.kind:"text", title=String(b.title||"").slice(0,120), text=String(b.body||"").trim();
    if(!text&&!title)return json({ok:false,error:"投稿内容を入力してください。"},400);
    const pid=id();await env.DB.prepare("INSERT INTO posts(id,user_id,kind,title,body,created_at) VALUES(?,?,?,?,?,?)").bind(pid,me.id,kind,title,text,now()).run();
    return json({ok:true,id:pid},201);
   }
   const like=p.match(/^\/api\/posts\/([a-f0-9-]+)\/like$/);
   if(like&&method==="POST"){
    if(!me)return json({ok:false,error:"ログインしてください。"},401);
    const exists=await env.DB.prepare("SELECT 1 FROM likes WHERE user_id=? AND post_id=?").bind(me.id,like[1]).first();
    if(exists)await env.DB.prepare("DELETE FROM likes WHERE user_id=? AND post_id=?").bind(me.id,like[1]).run();
    else await env.DB.prepare("INSERT OR IGNORE INTO likes(user_id,post_id,created_at) VALUES(?,?,?)").bind(me.id,like[1],now()).run();
    return json({ok:true,liked:!exists});
   }
   const comment=p.match(/^\/api\/posts\/([a-f0-9-]+)\/comments$/);
   if(comment&&method==="POST"){
    if(!me)return json({ok:false,error:"ログインしてください。"},401);
    const b=await body(req), text=String(b.body||"").trim().slice(0,2000);if(!text)return json({ok:false,error:"コメントを入力してください。"},400);
    await env.DB.prepare("INSERT INTO comments(id,post_id,user_id,body,created_at) VALUES(?,?,?,?,?)").bind(id(),comment[1],me.id,text,now()).run();return json({ok:true});
   }
   if(p==="/api/follows"&&method==="GET"){
    if(!me)return json({ok:false,error:"ログインしてください。"},401);
    const rows=await env.DB.prepare("SELECT users.id,users.display_name,users.handle,CASE WHEN EXISTS(SELECT 1 FROM follows f2 WHERE f2.follower_id=users.id AND f2.followed_id=?) THEN 1 ELSE 0 END AS mutual FROM follows JOIN users ON users.id=follows.followed_id WHERE follows.follower_id=?").bind(me.id,me.id).all();
    return json({ok:true,following:rows.results||[]});
   }
   if(p==="/api/follows"&&method==="POST"){
    if(!me)return json({ok:false,error:"ログインしてください。"},401);
    const b=await body(req), target=String(b.user_id||"");if(!target||target===me.id)return json({ok:false,error:"対象ユーザーを確認してください。"},400);
    const ex=await env.DB.prepare("SELECT 1 FROM follows WHERE follower_id=? AND followed_id=?").bind(me.id,target).first();
    if(ex)await env.DB.prepare("DELETE FROM follows WHERE follower_id=? AND followed_id=?").bind(me.id,target).run();
    else await env.DB.prepare("INSERT OR IGNORE INTO follows(follower_id,followed_id,created_at) VALUES(?,?,?)").bind(me.id,target,now()).run();
    return json({ok:true,following:!ex});
   }
   if(p==="/api/boards"&&method==="GET"){
    const rows=await env.DB.prepare("SELECT boards.id,boards.title,boards.description,boards.created_at,users.display_name FROM boards JOIN users ON users.id=boards.created_by WHERE approved=1 ORDER BY created_at DESC").all();
    return json({ok:true,boards:rows.results||[]});
   }
   if(p==="/api/boards"&&method==="POST"){
    if(!me)return json({ok:false,error:"ログインしてください。"},401);
    const b=await body(req), title=String(b.title||"").trim().slice(0,80), description=String(b.description||"").slice(0,500);
    if(!title)return json({ok:false,error:"板の名前を入力してください。"},400);
    await env.DB.prepare("INSERT INTO boards(id,title,description,created_by,approved,created_at) VALUES(?,?,?,?,0,?)").bind(id(),title,description,me.id,now()).run();
    return json({ok:true,message:"板の作成申請を受け付けました。管理者の承認後に公開されます。"});
   }
   if(p==="/api/admin/login"&&method==="POST"){
    if(!env.ADMIN_PASSWORD||!env.SESSION_SECRET)return json({ok:false,error:"ADMIN_PASSWORD と SESSION_SECRET のSecret設定が必要です。"},503);
    const b=await body(req);if(String(b.password||"")!==env.ADMIN_PASSWORD)return json({ok:false,error:"パスワードが違います。"},401);
    const payload=b64(enc.encode(JSON.stringify({role:"admin",exp:now()+3600*8}))), sig=await sign(payload,env.SESSION_SECRET);
    return json({ok:true},200,{"Set-Cookie":`auvexa_admin=${payload}.${sig}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`});
   }
   if(p.startsWith("/api/admin/")){
    if(!await adminOK(req,env))return json({ok:false,error:"管理者ログインが必要です。"},401);
    if(p==="/api/admin/overview"&&method==="GET"){
     const [users,posts,boards,maint]=await Promise.all([
      env.DB.prepare("SELECT COUNT(*) n FROM users").first(),env.DB.prepare("SELECT COUNT(*) n FROM posts").first(),
      env.DB.prepare("SELECT COUNT(*) n FROM boards WHERE approved=0").first(),env.DB.prepare("SELECT * FROM maintenance WHERE id=1").first()]);
     return json({ok:true,users:users.n,posts:posts.n,pendingBoards:boards.n,maintenance:maint});
    }
    if(p==="/api/admin/maintenance"&&method==="POST"){
     const b=await body(req);await env.DB.prepare("UPDATE maintenance SET enabled=?,message=?,start_at=?,end_at=?,version=?,updated_at=? WHERE id=1").bind(b.enabled?1:0,String(b.message||"").slice(0,2000),String(b.start_at||""),String(b.end_at||""),String(b.version||"1.0.0").slice(0,20),now()).run();return json({ok:true});
    }
    const approve=p.match(/^\/api\/admin\/boards\/([a-f0-9-]+)\/approve$/);
    if(approve&&method==="POST"){await env.DB.prepare("UPDATE boards SET approved=1 WHERE id=?").bind(approve[1]).run();return json({ok:true})}
   }
   return json({ok:false,error:"このAPIは未実装です。"},404);
  }
  return env.ASSETS.fetch(req);
 }
};
