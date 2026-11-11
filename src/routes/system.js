import { json } from "../http.js";
import { tableCount, storageUsed } from "../db.js";
import { APP } from "../config.js";

export async function systemRoutes(request, env, url) {
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({ ok: true, app: env.APP_NAME || APP.name, version: env.APP_VERSION || APP.version, status: "running", time: new Date().toISOString() });
  }
  if (url.pathname === "/api/system/status" && request.method === "GET") {
    const count = await tableCount(env.DB);
    const used = await storageUsed(env.DB);
    const limit = Number(env.STORAGE_LIMIT_BYTES || APP.storageLimitBytes);
    return json({ ok: true, database: { connected: true, tableCount: count }, storage: { usedBytes: used, limitBytes: limit, percent: Math.min(100, Math.round(used / limit * 100)), r2Configured: Boolean(env.MEDIA_BUCKET) } });
  }
  return null;
}
