import { json, error, isSameOrigin } from "./src/http.js";
import { systemRoutes } from "./src/routes/system.js";
import { authRoutes } from "./src/routes/auth.js";
import { mediaRoutes } from "./src/routes/media.js";
import { postRoutes } from "./src/routes/posts.js";
import { serviceRoutes } from "./src/routes/services.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": url.origin, "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin" } });
    if (url.pathname.startsWith("/api/") && !isSameOrigin(request)) return error("許可されていない接続元です。", 403);
    try {
      for (const handler of [systemRoutes, authRoutes, mediaRoutes, postRoutes, serviceRoutes]) {
        const response = await handler(request, env, url);
        if (response) return response;
      }
      if (url.pathname.startsWith("/api/")) return error("APIが見つかりません。", 404);
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("AuvexaConnect assets binding is not configured.", { status: 503 });
    } catch (e) {
      console.error("AuvexaConnect request error", e);
      return error("サーバー内部でエラーが発生しました。", 500);
    }
  }
};
