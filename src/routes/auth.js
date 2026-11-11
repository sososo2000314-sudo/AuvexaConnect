import { json, error, readJson, cookieValue, sessionCookie, clearSessionCookie, safeText } from "../http.js";
import { randomId, sha256, hashPassword, verifyPassword, validEmail, validHandle } from "../security.js";
import { first, run } from "../db.js";

const SESSION_SECONDS = 60 * 60 * 24 * 30;

export async function currentUser(request, env) {
  const token = cookieValue(request, "auvexa_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  return first(env.DB, `SELECT u.id,u.email,u.username,u.handle,u.display_name,u.bio,u.avatar_url,u.header_url,u.country,u.language,u.account_status,u.created_at FROM login_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.account_status='active' AND u.deleted_at IS NULL`, [tokenHash, new Date().toISOString()]);
}

export async function authRoutes(request, env, url) {
  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    const data = await readJson(request);
    const email = safeText(data.email, 254).toLowerCase();
    const handle = safeText(data.handle, 24).replace(/^@/, "");
    const username = safeText(data.username || handle, 80);
    const password = String(data.password || "");
    if (!validEmail(email)) return error("メールアドレスを確認してください。");
    if (!validHandle(handle)) return error("IDは半角英数字と_で3〜24文字にしてください。");
    if (password.length < 10 || password.length > 128) return error("パスワードは10〜128文字にしてください。");
    if (await first(env.DB, "SELECT id FROM users WHERE email=? OR handle=?", [email, handle])) return error("メールアドレスまたはIDは既に使われています。", 409);
    const id = randomId(16);
    const passwordHash = await hashPassword(password);
    await run(env.DB, `INSERT INTO users(id,email,password_hash,username,handle,display_name,language) VALUES(?,?,?,?,?,?,?)`, [id,email,passwordHash,username,handle,safeText(data.displayName || username,80),safeText(data.language || "ja",8)]);
    await run(env.DB, `INSERT OR IGNORE INTO user_preferences(user_id,language,theme) VALUES(?,?,?)`, [id,safeText(data.language || "ja",8),"night"]);
    return json({ ok: true, message: "登録しました。ログインしてください。" }, 201);
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const data = await readJson(request);
    const identity = safeText(data.identity, 254).toLowerCase();
    const user = await first(env.DB, `SELECT id,email,password_hash,account_status FROM users WHERE (email=? OR handle=?) AND deleted_at IS NULL`, [identity, identity.replace(/^@/, "")]);
    if (!user || !(await verifyPassword(String(data.password || ""), user.password_hash))) {
      if (user) await run(env.DB, `INSERT INTO login_history(id,user_id,result) VALUES(?,?,?)`, [randomId(16),user.id,"failed"]);
      return error("メールアドレス・IDまたはパスワードが違います。", 401);
    }
    if (user.account_status !== "active") return error("このアカウントは現在利用できません。", 403);
    const token = randomId(32);
    const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
    await run(env.DB, `INSERT INTO login_sessions(id,user_id,token_hash,device_name,browser,expires_at,last_seen_at) VALUES(?,?,?,?,?,?,?)`, [randomId(16),user.id,await sha256(token),safeText(request.headers.get("User-Agent"),180),safeText(request.headers.get("User-Agent"),180),expires,new Date().toISOString()]);
    await run(env.DB, `INSERT INTO login_history(id,user_id,result) VALUES(?,?,?)`, [randomId(16),user.id,"success"]);
    return json({ ok: true }, 200, { "Set-Cookie": sessionCookie(token, SESSION_SECONDS) });
  }

  if (url.pathname === "/api/auth/me" && request.method === "GET") {
    const user = await currentUser(request, env);
    return json({ ok: true, user: user || null });
  }

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = cookieValue(request, "auvexa_session");
    if (token) await run(env.DB, `UPDATE login_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL`, [new Date().toISOString(), await sha256(token)]);
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  }
  return null;
}
