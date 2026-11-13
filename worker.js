const JSON_HEADERS = {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"};
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:JSON_HEADERS});
const now = ()=>new Date().toISOString();
const clean = (v,max=5000)=>String(v??"").trim().slice(0,max);
const userId = req=>req.headers.get("X-User-Id");
async function currentUser(req,env){
  const id=userId(req); if(!id) return null;
  return await env.DB.prepare("SELECT id,name FROM beta_users WHERE id=?").bind(id).first();
}
function safeName(name){return clean(name,24).replace(/\s+/g," ");}
function extFromType(type){const map={"video/mp4":"mp4","video/webm":"webm","video/quicktime":"mov","video/ogg":"ogv"};return map[type]||"bin";}
async function route(req,env){
  const url=new URL(req.url), path=url.pathname;
  if(path==="/api/login"&&req.method==="POST"){
    const body=await req.json().catch(()=>({})), name=safeName(body.name);
    if(name.length<2) return json({error:"アカウント名は2文字以上で入力してください。"},400);
    let user=await env.DB.prepare("SELECT id,name FROM beta_users WHERE name_key=?").bind(name.toLocaleLowerCase()).first();
    if(!user){
      const id=crypto.randomUUID();
      try {await env.DB.prepare("INSERT INTO beta_users(id,name,name_key,created_at) VALUES(?,?,?,?)").bind(id,name,name.toLocaleLowerCase(),now()).run();}
      catch(e){return json({error:"アカウントを作成できませんでした。"},500);}
      user={id,name};
    }
    return json({user});
  }
  const user=await currentUser(req,env);
  if(!user) return json({error:"ログインしてください。"},401);

  if(path==="/api/videos"&&req.method==="GET"){
    const {results}=await env.DB.prepare(`SELECT v.id,v.title,v.object_key,v.created_at,u.name AS author FROM beta_videos v JOIN beta_users u ON u.id=v.user_id ORDER BY v.created_at DESC LIMIT 100`).all();
    return json({videos:results.map(v=>({...v,url:"/api/video/"+encodeURIComponent(v.id)}))});
  }
  if(path==="/api/videos"&&req.method==="POST"){
    const type=req.headers.get("Content-Type")||"";
    const length=Number(req.headers.get("Content-Length")||0);
    if(!type.startsWith("video/")) return json({error:"動画ファイルを送信してください。"},415);
    if(length>100*1024*1024) return json({error:"動画は100MB以下にしてください。"},413);
    const data=await req.arrayBuffer();
    if(data.byteLength===0||data.byteLength>100*1024*1024) return json({error:"動画サイズが不正です（最大100MB）。"},413);
    const id=crypto.randomUUID(), key=`videos/${id}.${extFromType(type)}`;
    await env.VIDEOS.put(key,data,{httpMetadata:{contentType:type}});
    const title=decodeURIComponent(req.headers.get("X-Video-Title")||"動画").slice(0,100);
    await env.DB.prepare("INSERT INTO beta_videos(id,user_id,title,object_key,created_at) VALUES(?,?,?,?,?)").bind(id,user.id,title,key,now()).run();
    return json({ok:true,id});
  }
  if(path.startsWith("/api/video/")&&req.method==="GET"){
    const id=decodeURIComponent(path.slice("/api/video/".length));
    const item=await env.DB.prepare("SELECT object_key FROM beta_videos WHERE id=?").bind(id).first();
    if(!item) return json({error:"動画が見つかりません。"},404);
    const object=await env.VIDEOS.get(item.object_key);
    if(!object) return json({error:"動画ファイルが見つかりません。"},404);
    const headers=new Headers();object.writeHttpMetadata(headers);headers.set("Cache-Control","private, max-age=300");
    return new Response(object.body,{headers});
  }
  if(path==="/api/mail"&&req.method==="GET"){
    const {results}=await env.DB.prepare(`SELECT m.id,m.subject,m.body,m.created_at,u.name AS sender FROM beta_messages m JOIN beta_users u ON u.id=m.sender_id WHERE m.recipient_id=? ORDER BY m.created_at DESC LIMIT 100`).bind(user.id).all();
    return json({messages:results});
  }
  if(path==="/api/mail"&&req.method==="POST"){
    const body=await req.json().catch(()=>({})), to=safeName(body.to), subject=clean(body.subject,120), message=clean(body.body,5000);
    if(!to||!message) return json({error:"宛先と本文を入力してください。"},400);
    const recipient=await env.DB.prepare("SELECT id FROM beta_users WHERE name_key=?").bind(to.toLocaleLowerCase()).first();
    if(!recipient) return json({error:"そのアカウント名は見つかりません。先に相手にログインしてもらってください。"},404);
    await env.DB.prepare("INSERT INTO beta_messages(id,sender_id,recipient_id,subject,body,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),user.id,recipient.id,subject,message,now()).run();
    return json({ok:true});
  }
  if(path==="/api/profile"&&req.method==="GET"){
    const profile=await env.DB.prepare("SELECT display_name,user_tag,bio,avatar_url,header_url,website_url,location,birthday FROM beta_profiles WHERE user_id=?").bind(user.id).first();
    return json({profile:profile||{}});
  }
  if(path==="/api/profile"&&req.method==="PUT"){
    const p=await req.json().catch(()=>({}));
    const tag=clean(p.user_tag,24);
    if(tag&&!/^[A-Za-z0-9_]{2,24}$/.test(tag)) return json({error:"ユーザーIDは英数字と _ の2〜24文字にしてください。"},400);
    const values=[clean(p.display_name,40),tag,clean(p.bio,500),clean(p.avatar_url,500),clean(p.header_url,500),clean(p.website_url,500),clean(p.location,80),clean(p.birthday,10)];
    try{
      await env.DB.prepare(`INSERT INTO beta_profiles(user_id,display_name,user_tag,bio,avatar_url,header_url,website_url,location,birthday,updated_at)
      VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET display_name=excluded.display_name,user_tag=excluded.user_tag,bio=excluded.bio,avatar_url=excluded.avatar_url,header_url=excluded.header_url,website_url=excluded.website_url,location=excluded.location,birthday=excluded.birthday,updated_at=excluded.updated_at`).bind(user.id,...values,now()).run();
    }catch(e){return json({error:"このユーザーIDはすでに使われている可能性があります。"},409);}
    return json({ok:true});
  }
  return json({error:"API endpoint not found"},404);
}
export default {
  async fetch(request,env,ctx){
    const url=new URL(request.url);
    if(url.pathname.startsWith("/api/")){
      try{return await route(request,env);}catch(e){return json({error:"サーバー内部でエラーが発生しました。設定とデータベースを確認してください。"},500);}
    }
    return env.ASSETS.fetch(request);
  }
};