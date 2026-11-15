export interface Env { DB: D1Database; ADMIN_BOOTSTRAP_SECRET?: string; }

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { "content-type": "application/json; charset=utf-8" }
});

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/api/health") {
      return reply({ service: "AuvexaConnect API", status: "online", stage: "foundation" });
    }
    if (request.method === "GET" && url.pathname === "/api/features") {
      return reply({ registry: "docs/SPEC_INDEX.md", stage: "foundation",
        message: "仕様台帳と基盤のみ。全機能が実装済みという意味ではありません。" });
    }
    return reply({ error: "Not found" }, 404);
  }
};
