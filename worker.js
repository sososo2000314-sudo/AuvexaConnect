const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const COOKIE = "ac_session";
const DAY = 86400;

function json(data, status=200, headers={}) {
  return new Response(JSON.stringify(data), {status, headers:{...JSON_HEADERS, ...headers}});
}
function fail(message, status=400) { return json({ok:false,error:message}, status); }
function uid(prefix="") { return prefix + crypto.randomUUID().replaceAll("-",""); }
function escCookie(value, maxAge) {
  return `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}
async function hashPassword(password, saltHex) {
  const salt = saltHex ? Uint8Array.from(saltHex.match(/.{2}/g).map(x=>parseInt(x,16))) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:210000,hash:"SHA-256"},key,256);
  return {salt:[...salt].map(x=>x.toString(16).padStart(2,"0")).join(""), hash:[...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,"0")).join("")};
}
async function verifyPassword(password, stored) {
  const [salt, expected] = stored.split(":");
  const got = await hashPassword(password,salt);
  return constantTime(got.hash, expected);
}
function constantTime(a,b) {
  if (!a || !b || a.length!==b.length) return false;
  let v=0; for(let i=0;i<a.length;i++) v |= a.charCodeAt(i)^b.charCodeAt(i); return v===0;
}
function cookieValue(request) {
  const raw=request.headers.get("Cookie")||"";
  const item=raw.split(";").map(x=>x.trim()).find(x=>x.startsWith(COOKIE+"="));
  return item ? item.slice(COOKIE.length+1) : null;
}
async function currentUser(request, env) {
  const token=cookieValue(request); if(!token) return null;
  return await env.DB.prepare(`SELECT u.id,u.email,u.display_name,u.handle,u.avatar_url,u.bio,u.app_number,u.virtual_phone,u.language,u.role,u.status,u.tutorial_completed FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at > datetime('now') AND u.status='active'`).bind(token).first();
}
async function requireUser(request,env) {
  const user=await currentUser(request,env); return user || null;
}
async function body(request) { try{return await request.json();}catch{return {};} }
async function uniqueNumber(env, column, prefix, digits) {
  for(let i=0;i<30;i++){
    const n=prefix+Array.from(crypto.getRandomValues(new Uint8Array(digits))).map(x=>String(x%10)).join("");
    const found=await env.DB.prepare(`SELECT id FROM users WHERE ${column}=?`).bind(n).first();
    if(!found) return n;
  }
  throw new Error("番号を発行できませんでした。再試行してください。");
}
async function ensureSchema(env) {
  // Deploy schema.sql separately using `wrangler d1 execute japan-connect-db --remote --file=schema.sql`.
  const check=await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").first();
  if(!check) throw new Error("D1 schema is not installed. Run schema.sql against japan-connect-db.");
}
async function notify(env,userId,type,title,text="") {
  await env.DB.prepare("INSERT INTO notifications(id,user_id,type,title,body) VALUES(?,?,?,?,?)").bind(uid("n_"),userId,type,title,text).run();
}
async function api(request,env,url) {
  await ensureSchema(env);
  const path=url.pathname, method=request.method;
  if(path==="/api/health") return json({ok:true,app:"AuvexaConnect",time:new Date().toISOString(),uptime:"Worker is serverless; no persistent process uptime"});
  if(path==="/api/register" && method==="POST"){
    const b=await body(request);
    const email=String(b.email||"").trim().toLowerCase(), password=String(b.password||""), name=String(b.displayName||"").trim();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("メールアドレスを確認してください。");
    if(password.length<10) return fail("パスワードは10文字以上にしてください。");
    if(name.length<1||name.length>40) return fail("表示名を1〜40文字で入力してください。");
    const existing=await env.DB.prepare("SELECT id FROM users WHERE email=?").bind(email).first();
    if(existing) return fail("このメールアドレスは登録済みです。",409);
    const id=uid("u_"), handle=(String(b.handle||"user").toLowerCase().replace(/[^a-z0-9_]/g,"").slice(0,18)||"user")+"_"+id.slice(-5);
    const appNumber=await uniqueNumber(env,"app_number","AC-",8);
    // This is an internal directory identifier, not a Japanese public telephone number.
    const virtualPhone=await uniqueNumber(env,"virtual_phone","000",8);
    const hp=await hashPassword(password);
    const address=`${handle}@auvexa.com`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users(id,email,password_hash,display_name,handle,app_number,virtual_phone,language) VALUES(?,?,?,?,?,?,?,?)").bind(id,email,hp.salt+":"+hp.hash,name,handle,appNumber,virtualPhone,b.language==="en"?"en":"ja"),
      env.DB.prepare("INSERT INTO mailboxes(id,user_id,address) VALUES(?,?,?)").bind(uid("mb_"),id,address)
    ]);
    const token=uid("s_"), expires=new Date(Date.now()+30*DAY*1000).toISOString();
    await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)").bind(token,id,expires).run();
    const user=await env.DB.prepare("SELECT id,email,display_name,handle,app_number,virtual_phone,language,role,tutorial_completed FROM users WHERE id=?").bind(id).first();
    return json({ok:true,user,mailbox:address,notice:"@auvexa.com はアプリ内メール用アドレスです。外部メール送受信にはメール事業者の接続が必要です。"},201,{"set-cookie":escCookie(token,30*DAY)});
  }
  if(path==="/api/login" && method==="POST"){
    const b=await body(request), email=String(b.email||"").trim().toLowerCase();
    const u=await env.DB.prepare("SELECT id,password_hash,status FROM users WHERE email=?").bind(email).first();
    if(!u||u.status!=="active"||!(await verifyPassword(String(b.password||""),u.password_hash))) return fail("メールアドレスまたはパスワードが違います。",401);
    const token=uid("s_"), expires=new Date(Date.now()+30*DAY*1000).toISOString();
    await env.DB.prepare("INSERT INTO sessions(id,user_id,expires_at) VALUES(?,?,?)").bind(token,u.id,expires).run();
    return json({ok:true,user:await env.DB.prepare("SELECT id,email,display_name,handle,app_number,virtual_phone,language,role FROM users WHERE id=?").bind(u.id).first()},200,{"set-cookie":escCookie(token,30*DAY)});
  }
  if(path==="/api/logout" && method==="POST"){
    const token=cookieValue(request); if(token) await env.DB.prepare("DELETE FROM sessions WHERE id=?").bind(token).run();
    return json({ok:true},200,{"set-cookie":escCookie("",0)});
  }
  const user=await requireUser(request,env);
  if(path==="/api/me" && method==="GET") return json({ok:true,user});
  if(!user) return fail("ログインしてください。",401);
  if(path==="/api/profile" && method==="PATCH"){
    const b=await body(request);
    await env.DB.prepare("UPDATE users SET display_name=?,bio=?,avatar_url=?,language=?,updated_at=datetime('now') WHERE id=?").bind(String(b.displayName||user.display_name).slice(0,40),String(b.bio||"").slice(0,500),String(b.avatarUrl||"").slice(0,500),b.language==="en"?"en":"ja",user.id).run();
    return json({ok:true});
  }
  if(path==="/api/tutorial/complete" && method==="POST"){
    await env.DB.prepare("UPDATE users SET tutorial_completed=1 WHERE id=?").bind(user.id).run(); return json({ok:true});
  }
  if(path==="/api/feed" && method==="GET"){
    const rows=await env.DB.prepare(`SELECT p.*,u.display_name,u.handle,u.avatar_url,(SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id) likes,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) comments,(SELECT COUNT(*) FROM likes l WHERE l.post_id=p.id AND l.user_id=?) liked FROM posts p JOIN users u ON u.id=p.user_id WHERE p.visibility='public' ORDER BY p.created_at DESC LIMIT 100`).bind(user.id).all();
    return json({ok:true,posts:rows.results});
  }
  if(path==="/api/posts" && method==="POST"){
    const b=await body(request), text=String(b.body||"").trim();
    if(!text) return fail("投稿内容を入力してください。");
    const id=uid("p_"); await env.DB.prepare("INSERT INTO posts(id,user_id,type,title,body,media_url) VALUES(?,?,?,?,?,?)").bind(id,user.id,String(b.type||"text"),String(b.title||"").slice(0,120),text.slice(0,10000),String(b.mediaUrl||"").slice(0,1000)).run();
    return json({ok:true,id},201);
  }
  const likeMatch=path.match(/^\/api\/posts\/([^/]+)\/like$/);
  if(likeMatch&&method==="POST"){
    const exists=await env.DB.prepare("SELECT 1 FROM likes WHERE user_id=? AND post_id=?").bind(user.id,likeMatch[1]).first();
    if(exists) await env.DB.prepare("DELETE FROM likes WHERE user_id=? AND post_id=?").bind(user.id,likeMatch[1]).run();
    else await env.DB.prepare("INSERT OR IGNORE INTO likes(user_id,post_id) VALUES(?,?)").bind(user.id,likeMatch[1]).run();
    return json({ok:true,liked:!exists});
  }
  if(path==="/api/comments" && method==="POST"){
    const b=await body(request); if(!String(b.body||"").trim()) return fail("コメントを入力してください。");
    await env.DB.prepare("INSERT INTO comments(id,post_id,user_id,body) VALUES(?,?,?,?)").bind(uid("c_"),b.postId,user.id,String(b.body).slice(0,3000)).run(); return json({ok:true},201);
  }
  if(path==="/api/search" && method==="GET"){
    const q=url.searchParams.get("q")||"";
    const rows=await env.DB.prepare("SELECT id,display_name,handle,app_number,virtual_phone,avatar_url FROM users WHERE status='active' AND (display_name LIKE ? OR handle LIKE ? OR app_number LIKE ? OR virtual_phone LIKE ?) LIMIT 30").bind("%"+q+"%","%"+q+"%","%"+q+"%","%"+q+"%").all();
    return json({ok:true,users:rows.results});
  }
  if(path==="/api/settings" && method==="GET"){
    const rows=await env.DB.prepare("SELECT key,value FROM user_settings WHERE user_id=?").bind(user.id).all(); return json({ok:true,settings:Object.fromEntries(rows.results.map(x=>[x.key,x.value]))});
  }
  if(path==="/api/settings" && method==="PUT"){
    const b=await body(request), allowed=["ringtone","mail_sound","chat_sound","call_volume","theme","language"];
    const stmts=[];
    for(const k of allowed) if(b[k]!==undefined) stmts.push(env.DB.prepare("INSERT INTO user_settings(user_id,key,value) VALUES(?,?,?) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')").bind(user.id,k,String(b[k]).slice(0,100)));
    if(stmts.length) await env.DB.batch(stmts); return json({ok:true});
  }
  if(path==="/api/mailbox" && method==="GET"){
    const box=await env.DB.prepare("SELECT address FROM mailboxes WHERE user_id=?").bind(user.id).first();
    const folder=url.searchParams.get("folder")==="sent"?"sent":"inbox";
    const rows=await env.DB.prepare("SELECT e.id,e.subject,e.body,e.folder,e.created_at, s.display_name sender_name, r.display_name recipient_name FROM emails e LEFT JOIN users s ON s.id=e.sender_id JOIN users r ON r.id=e.recipient_id WHERE e.deleted=0 AND ((e.folder='inbox' AND e.recipient_id=? AND ?='inbox') OR (e.folder='sent' AND e.sender_id=? AND ?='sent')) ORDER BY e.created_at DESC LIMIT 100").bind(user.id,folder,user.id,folder).all();
    return json({ok:true,address:box?.address,emails:rows.results});
  }
  if(path==="/api/mailbox/send" && method==="POST"){
    const b=await body(request), recipient=String(b.to||"").trim().toLowerCase();
    const target=await env.DB.prepare("SELECT user_id FROM mailboxes WHERE lower(address)=?").bind(recipient).first();
    if(!target) return fail("宛先が見つかりません。アプリ内メールアドレスを確認してください。",404);
    const id=uid("em_"), subject=String(b.subject||"").slice(0,200), content=String(b.body||"").slice(0,10000);
    if(!content.trim()) return fail("本文を入力してください。");
    await env.DB.batch([
      env.DB.prepare("INSERT INTO emails(id,sender_id,recipient_id,subject,body,folder) VALUES(?,?,?,?,?,'inbox')").bind(id,user.id,target.user_id,subject,content),
      env.DB.prepare("INSERT INTO emails(id,sender_id,recipient_id,subject,body,folder) VALUES(?,?,?,?,?,'sent')").bind(uid("em_"),user.id,target.user_id,subject,content)
    ]);
    await notify(env,target.user_id,"mail","新しいメール",subject);
    return json({ok:true},201);
  }
  if(path==="/api/mailbox/delete" && method==="POST"){
    const b=await body(request);
    await env.DB.prepare("UPDATE emails SET deleted=1 WHERE id=? AND (recipient_id=? OR sender_id=?)").bind(b.id,user.id,user.id).run(); return json({ok:true});
  }
  if(path==="/api/notifications" && method==="GET"){
    const rows=await env.DB.prepare("SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(user.id).all(); return json({ok:true,notifications:rows.results});
  }
  if(path==="/api/notifications/read" && method==="POST"){
    const b=await body(request); await env.DB.prepare("UPDATE notifications SET read_at=datetime('now') WHERE id=? AND user_id=?").bind(b.id,user.id).run(); return json({ok:true});
  }
  if(path==="/api/events" && method==="GET"){
    const rows=await env.DB.prepare("SELECT e.*,u.display_name creator_name FROM events e JOIN users u ON u.id=e.creator_id ORDER BY starts_at LIMIT 100").all(); return json({ok:true,events:rows.results});
  }
  if(path==="/api/events" && method==="POST"){
    const b=await body(request); if(!String(b.title||"").trim()) return fail("イベント名を入力してください。");
    await env.DB.prepare("INSERT INTO events(id,creator_id,title,description,starts_at,location) VALUES(?,?,?,?,?,?)").bind(uid("ev_"),user.id,String(b.title).slice(0,120),String(b.description||"").slice(0,3000),b.startsAt||null,String(b.location||"").slice(0,200)).run(); return json({ok:true},201);
  }
  if(path==="/api/feature-requests" && method==="POST"){
    const b=await body(request); await env.DB.prepare("INSERT INTO feature_requests(id,user_id,title,body) VALUES(?,?,?,?)").bind(uid("fr_"),user.id,String(b.title||"").slice(0,120),String(b.body||"").slice(0,3000)).run(); return json({ok:true},201);
  }
  if(path==="/api/classrooms" && method==="GET"){
    const rows=await env.DB.prepare("SELECT c.* FROM classrooms c LEFT JOIN classroom_members m ON m.classroom_id=c.id WHERE c.owner_id=? OR m.user_id=? ORDER BY c.created_at DESC").bind(user.id,user.id).all(); return json({ok:true,classrooms:rows.results});
  }
  if(path==="/api/classrooms" && method==="POST"){
    const b=await body(request); if(!String(b.title||"").trim()) return fail("教室名を入力してください。");
    const id=uid("cl_"); await env.DB.batch([
      env.DB.prepare("INSERT INTO classrooms(id,owner_id,title,description) VALUES(?,?,?,?)").bind(id,user.id,String(b.title).slice(0,120),String(b.description||"").slice(0,2000)),
      env.DB.prepare("INSERT INTO classroom_members(classroom_id,user_id,role) VALUES(?,?,'teacher')").bind(id,user.id)
    ]); return json({ok:true,id},201);
  }
  if(path==="/api/admin/unlock" && method==="POST"){
    const b=await body(request);
    const configured=env.ADMIN_PANEL_PASSWORD;
    if(!configured) return fail("ADMIN_PANEL_PASSWORD secret is not configured.",503);
    if(!constantTime(String(b.password||""),String(configured))) return fail("管理者パスワードが違います。",403);
    const token=uid("as_"), expires=new Date(Date.now()+60*60*1000).toISOString();
    await env.DB.prepare("INSERT INTO admin_sessions(id,user_id,expires_at) VALUES(?,?,?)").bind(token,user.id,expires).run();
    return json({ok:true},200,{"set-cookie":`ac_admin=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/admin; Max-Age=3600`});
  }
  if(path==="/api/admin" && method==="GET"){
    const adminCookie=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("ac_admin="));
    const adminToken=adminCookie?adminCookie.slice(9):"";
    const adminSession=adminToken?await env.DB.prepare("SELECT id FROM admin_sessions WHERE id=? AND user_id=? AND expires_at>datetime('now')").bind(adminToken,user.id).first():null;
    if(!adminSession) return fail("管理者パネルの認証が必要です。",403);
    const counts={}; for(const t of ["users","posts","emails","events","feature_requests","classrooms"]) { const x=await env.DB.prepare(`SELECT COUNT(*) n FROM ${t}`).first(); counts[t]=x.n; }
    const users=await env.DB.prepare("SELECT id,email,display_name,handle,app_number,virtual_phone,status,created_at FROM users ORDER BY created_at DESC LIMIT 200").all();
    const requests=await env.DB.prepare("SELECT * FROM feature_requests ORDER BY created_at DESC LIMIT 100").all();
    return json({ok:true,counts,users:users.results,requests:requests.results});
  }
  if(path==="/api/admin/alerts" && method==="POST"){
    const adminCookie=(request.headers.get("Cookie")||"").split(";").map(x=>x.trim()).find(x=>x.startsWith("ac_admin="));
    const adminToken=adminCookie?adminCookie.slice(9):"";
    const adminSession=adminToken?await env.DB.prepare("SELECT id FROM admin_sessions WHERE id=? AND user_id=? AND expires_at>datetime('now')").bind(adminToken,user.id).first():null;
    if(!adminSession) return fail("管理者パネルの認証が必要です。",403);
    const b=await body(request), id=uid("al_");
    await env.DB.prepare("INSERT INTO emergency_alerts(id,admin_id,title,body,region) VALUES(?,?,?,?,?)").bind(id,user.id,String(b.title||"").slice(0,120),String(b.body||"").slice(0,3000),String(b.region||"").slice(0,100)).run();
    const all=await env.DB.prepare("SELECT id FROM users WHERE status='active'").all();
    if(all.results.length) await env.DB.batch(all.results.map(x=>env.DB.prepare("INSERT INTO notifications(id,user_id,type,title,body) VALUES(?,?,?,?,?)").bind(uid("n_"),x.id,"emergency",String(b.title||"緊急情報"),String(b.body||""))));
    return json({ok:true,id},201);
  }
  if(path==="/api/calls/signal" && method==="POST"){
    const b=await body(request);
    const target=await env.DB.prepare("SELECT id FROM users WHERE id=? AND status='active'").bind(b.toUser).first();
    if(!target) return fail("相手が見つかりません。",404);
    await env.DB.prepare("INSERT INTO call_signals(id,room_id,from_user,to_user,signal_json) VALUES(?,?,?,?,?)").bind(uid("sig_"),String(b.roomId||"").slice(0,100),user.id,target.id,JSON.stringify(b.signal||{})).run();
    await notify(env,target.id,"call","着信があります",user.display_name);
    return json({ok:true},201);
  }
  if(path==="/api/calls/signals" && method==="GET"){
    const rows=await env.DB.prepare("SELECT * FROM call_signals WHERE to_user=? ORDER BY created_at LIMIT 100").bind(user.id).all(); return json({ok:true,signals:rows.results.map(x=>({...x,signal:JSON.parse(x.signal_json)}))});
  }
  if(path==="/api/profile" && method==="GET") return json({ok:true,user,links:(await env.DB.prepare("SELECT label,url FROM user_links WHERE user_id=? ORDER BY sort_order").bind(user.id).all()).results});
  if(path==="/api/account/delete" && method==="POST"){
    const b=await body(request); const row=await env.DB.prepare("SELECT password_hash FROM users WHERE id=?").bind(user.id).first();
    if(!(await verifyPassword(String(b.password||""),row.password_hash))) return fail("パスワードが違います。",403);
    await env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id).run(); return json({ok:true},200,{"set-cookie":escCookie("",0)});
  }
  return fail("API endpoint not found.",404);
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/")) {
      try { return await api(request,env,url); }
      catch(e) { return json({ok:false,error:e.message||"Internal error"},500); }
    }
    if(request.method!=="GET" && request.method!=="HEAD") return new Response("Method not allowed",{status:405});
    return env.ASSETS.fetch(request);
  }
};
