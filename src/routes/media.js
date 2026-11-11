import { json, error, cookieValue } from "../http.js";
import { randomId, sha256 } from "../security.js";
import { first, run, storageUsed } from "../db.js";
import { ALLOWED_UPLOAD_TYPES, APP } from "../config.js";

async function getUser(request, env) {
  const token = cookieValue(request, "auvexa_session");
  if (!token) return null;
  return first(env.DB, `SELECT u.id FROM login_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND u.account_status='active'`, [await sha256(token), new Date().toISOString()]);
}

export async function mediaRoutes(request, env, url) {
  if (url.pathname === "/api/media/upload" && request.method === "POST") {
    const user = await getUser(request, env);
    if (!user) return error("ログインしてください。", 401);
    if (!env.MEDIA_BUCKET) return error("ファイル保存機能はまだ有効になっていません。Cloudflare R2の設定が必要です。", 503);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return error("アップロードするファイルを選択してください。");
    const maxBytes = Number(env.MAX_UPLOAD_BYTES || APP.maxUploadBytes);
    if (file.size <= 0 || file.size > maxBytes) return error(`ファイルは1バイト以上${Math.floor(maxBytes / 1024 / 1024)}MB以下にしてください。`, 413);
    if (!ALLOWED_UPLOAD_TYPES.has(file.type)) return error("対応していないファイル形式です。");
    const used = await storageUsed(env.DB);
    const limit = Number(env.STORAGE_LIMIT_BYTES || APP.storageLimitBytes);
    const restrict = Number(env.STORAGE_RESTRICT_BYTES || APP.storageRestrictBytes);
    if (used + file.size > limit) return error("保存容量が10GBに達するためアップロードできません。不要なファイルを削除してください。", 413);
    if (used >= restrict) return error("保存容量が上限に近いため、新しい画像・動画・ファイルのアップロードを停止しています。", 413);
    const id = randomId(16);
    const key = `users/${user.id}/${id}`;
    await env.MEDIA_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    try {
      await run(env.DB, `INSERT INTO media_assets(id,owner_id,storage_key,media_type,mime_type,file_name,size_bytes,status) VALUES(?,?,?,?,?,?,?,?)`, [id,user.id,key,file.type.startsWith("video/")?"video":file.type.startsWith("image/")?"image":"file",file.type,file.name.slice(0,255),file.size,"ready"]);
    } catch (e) {
      await env.MEDIA_BUCKET.delete(key);
      throw e;
    }
    return json({ ok: true, media: { id, name: file.name, size: file.size, type: file.type }, storage: { usedBytes: used + file.size, limitBytes: limit, warning: used + file.size >= Number(env.STORAGE_WARNING_BYTES || APP.storageWarningBytes) } }, 201);
  }

  if (url.pathname.startsWith("/api/media/") && request.method === "GET") {
    const id = url.pathname.split("/").pop();
    const viewer = await getUser(request, env);
    if (!viewer) return error("ログインしてください。", 401);
    const row = await first(env.DB, `SELECT id,storage_key,mime_type,file_name,size_bytes FROM media_assets WHERE id=? AND owner_id=? AND status='ready'`, [id, viewer.id]);
    if (!row || !env.MEDIA_BUCKET) return error("ファイルが見つかりません。", 404);
    const object = await env.MEDIA_BUCKET.get(row.storage_key);
    if (!object) return error("ファイルが見つかりません。", 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.file_name || "file")}`);
    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(object.body, { headers });
  }
  return null;
}
