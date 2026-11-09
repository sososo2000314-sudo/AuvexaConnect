// AuvexaConnect Cloudflare Worker entry point.
// This starter serves static assets. API/database routes will be added in later implementation stages.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      return Response.json({ ok: false, message: 'API is not configured yet.' }, { status: 501 });
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('AuvexaConnect assets binding is not configured.', { status: 500 });
  }
};
