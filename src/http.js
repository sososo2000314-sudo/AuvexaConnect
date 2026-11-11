export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders
    }
  });
}

export function error(message, status = 400) {
  return json({ ok: false, error: message }, status);
}

export async function readJson(request, maxBytes = 1024 * 1024) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) throw new Error("JSON形式で送信してください。");
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > maxBytes) throw new Error("送信データが大きすぎます。");
  try { return JSON.parse(raw); } catch { throw new Error("JSONを読み取れません。"); }
}

export function cookieValue(request, name) {
  const cookie = request.headers.get("Cookie") || "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

export function sessionCookie(token, maxAge = 60 * 60 * 24 * 30) {
  return `auvexa_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export function clearSessionCookie() {
  return "auvexa_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0";
}

export function safeText(value, max = 5000) {
  return String(value ?? "").trim().slice(0, max);
}

export function isSameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; }
  catch { return false; }
}
