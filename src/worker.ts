import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types";
import { AppContext, loadUser, requireUser, requireAdmin } from "./auth";
import { randomId, newSalt, passwordHash, sha256 } from "./security";

const app = new Hono<{Bindings:Env;Variables:{user: any|null}}>();
app.use("/api/*", cors({origin:"*",allowMethods:["GET","POST","PATCH","DELETE","OPTIONS"],allowHeaders:["Content-Type","Authorization"]}));
app.use("/api/*", loadUser as any);

app.onError((err,c) => {
  const msg = err.message;
  const status = msg==="UNAUTHORIZED" ? 401 : msg==="FORBIDDEN" ? 403 : msg==="SUSPENDED" ? 403 : 500;
  return c.json({error: msg==="SUSPENDED" ? "このアカウントは利用停止中です。" : "リクエストを処理できませんでした。",code:msg},status);
});
app.get("/api/health", c => c.json({ok:true,service:"AuvexaConnect",part:1,apiVersion:"1.0"}));

app.post("/api/auth/register", async c => {
  const body = await c.req.json<{username:string;password:string;displayName?:string}>();
  const username = (body.username||"").trim();
  if (!/^[A-Za-z0-9_ぁ-んァ-ヶ一-龠-]{3,24}$/.test(username) || (body.password||"").length < 10)
    return c.json({error:"ユーザー名は3〜24文字、パスワードは10文字以上にしてください。",code:"INVALID_INPUT"},400);
  const salt = newSalt(), hash = await passwordHash(body.password,salt), id = randomId();
  try {
    await c.env.DB.prepare("INSERT INTO ac_users(id,username,password_hash,password_salt,display_name) VALUES(?,?,?,?,?)")
      .bind(id,username,hash,salt,(body.displayName||username).slice(0,40)).run();
  } catch { return c.json({error:"そのユーザー名は使用されています。",code:"USERNAME_TAKEN"},409); }
  return c.json({ok:true,userId:id,message:"アカウントを作成しました。続けてログインしてください。"},201);
});
app.post("/api/auth/login", async c => {
  const body = await c.req.json<{username:string;password:string}>();
  const row = await c.env.DB.prepare("SELECT id,password_hash,password_salt,status FROM ac_users WHERE username=? COLLATE NOCASE")
    .bind((body.username||"").trim()).first<any>();
  if (!row || await passwordHash(body.password||"",row.password_salt) !== row.password_hash)
    return c.json({error:"ユーザー名またはパスワードが違います。",code:"LOGIN_FAILED"},401);
  if (row.status !== "active") return c.json({error:"このアカウントは利用停止中です。",code:"SUSPENDED"},403);
  const token = `${randomId()}${randomId()}`;
  await c.env.DB.prepare("INSERT INTO ac_sessions(token_hash,user_id,expires_at) VALUES(?,?,datetime('now','+30 days'))")
    .bind(await sha256(token),row.id).run();
  return c.json({token,expiresInDays:30});
});
app.post("/api/auth/logout", async c => {
  const token = c.req.header("Authorization")?.replace(/^Bearer /,"");
  if (token) await c.env.DB.prepare("DELETE FROM ac_sessions WHERE token_hash=?").bind(await sha256(token)).run();
  return c.json({ok:true});
});
app.get("/api/me", c => c.json({user:requireUser(c as any)}));
app.patch("/api/me", async c => {
  const u = requireUser(c as any), b = await c.req.json<any>();
  const display = typeof b.displayName==="string" ? b.displayName.slice(0,40) : u.display_name;
  const bio = typeof b.bio==="string" ? b.bio.slice(0,300) : u.bio;
  const avatar = typeof b.avatarUrl==="string" ? b.avatarUrl.slice(0,2048) : u.avatar_url;
  const lang = ["ja","en"].includes(b.language) ? b.language : u.language;
  await c.env.DB.prepare("UPDATE ac_users SET display_name=?,bio=?,avatar_url=?,language=?,updated_at=CURRENT_TIMESTAMP WHERE id=?")
    .bind(display,bio,avatar,lang,u.id).run();
  return c.json({ok:true});
});
app.get("/api/posts", async c => {
  const rows = await c.env.DB.prepare(
    `SELECT p.id,p.body,p.media_url,p.media_type,p.visibility,p.created_at,
      u.id AS user_id,u.username,u.display_name,u.avatar_url
     FROM ac_posts p JOIN ac_users u ON u.id=p.user_id
     WHERE p.visibility='public' ORDER BY p.created_at DESC LIMIT 50`
  ).all();
  return c.json({posts:rows.results});
});
app.post("/api/posts", async c => {
  const u = requireUser(c as any), b = await c.req.json<any>();
  const body = String(b.body||"").slice(0,2000), media = b.mediaUrl ? String(b.mediaUrl).slice(0,2048) : null;
  if (!body && !media) return c.json({error:"本文または画像URLを入力してください。",code:"EMPTY_POST"},400);
  const id = randomId();
  await c.env.DB.prepare("INSERT INTO ac_posts(id,user_id,body,media_url,media_type,visibility) VALUES(?,?,?,?,?,?)")
    .bind(id,u.id,body,media,b.mediaType==="video"?"video":"image",b.visibility==="friends"?"friends":"public").run();
  return c.json({ok:true,id},201);
});
app.post("/api/follow/:id", async c => {
  const u = requireUser(c as any), target = c.req.param("id");
  if (u.id===target) return c.json({error:"自分はフォローできません。",code:"SELF_FOLLOW"},400);
  await c.env.DB.prepare("INSERT OR IGNORE INTO ac_follows(follower_id,followed_id) VALUES(?,?)").bind(u.id,target).run();
  return c.json({ok:true});
});
app.delete("/api/follow/:id", async c => {
  const u = requireUser(c as any);
  await c.env.DB.prepare("DELETE FROM ac_follows WHERE follower_id=? AND followed_id=?").bind(u.id,c.req.param("id")).run();
  return c.json({ok:true});
});
app.get("/api/notifications", async c => {
  const u = requireUser(c as any);
  const rows = await c.env.DB.prepare("SELECT * FROM ac_notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 100").bind(u.id).all();
  return c.json({notifications:rows.results});
});
app.post("/api/notifications/:id/read", async c => {
  const u = requireUser(c as any);
  await c.env.DB.prepare("UPDATE ac_notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?").bind(c.req.param("id"),u.id).run();
  return c.json({ok:true});
});
app.get("/api/connect-plus/compatibility", c => c.json({
  compatible:true, contractVersion:"1.0",
  identity:{key:"userId",source:"AuvexaConnect shared account"},
  auth:{scheme:"Bearer",tokenAudience:"auvexa-family"},
  capabilities:["shared-user-id","profile-reference","friend-reference","notification-events","internal-11-digit-number"],
  note:"Connect Plus must validate tokens server-side. Never trust a userId supplied by the client."
}));
app.get("/api/admin/status", c => {
  const u = requireAdmin(c as any);
  return c.json({admin:u.username,authorized:true});
});
app.patch("/api/admin/maintenance", async c => {
  requireAdmin(c as any);
  const b = await c.req.json<{enabled:boolean;message?:string}>();
  await c.env.DB.prepare("INSERT INTO ac_app_settings(setting_key,setting_value,updated_at) VALUES('maintenance_enabled',?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP")
    .bind(String(!!b.enabled)).run();
  if (b.message) await c.env.DB.prepare("INSERT INTO ac_app_settings(setting_key,setting_value,updated_at) VALUES('maintenance_message',?,CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value,updated_at=CURRENT_TIMESTAMP")
    .bind(b.message.slice(0,300)).run();
  await c.env.DB.prepare("INSERT INTO ac_audit_log(id,actor_user_id,action,details_json) VALUES(?,?,?,?)")
    .bind(randomId(),(c as any).get("user").id,"maintenance_update",JSON.stringify({enabled:!!b.enabled})).run();
  return c.json({ok:true});
});
app.get("/api/public/config", async c => {
  const rows = await c.env.DB.prepare("SELECT setting_key,setting_value FROM ac_app_settings WHERE setting_key IN ('maintenance_enabled','maintenance_message','default_language','connect_plus_enabled')").all<any>();
  return c.json(Object.fromEntries(rows.results.map((r:any)=>[r.setting_key,r.setting_value])));
});
app.all("*", async (c) => c.env.ASSETS.fetch(c.req.raw));
export default app;
