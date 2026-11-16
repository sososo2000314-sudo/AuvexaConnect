import type { Context, Next } from "hono";
import type { Env, AuthUser } from "./types";
import { bearer, sha256 } from "./security";
export type AppContext = Context<{Bindings:Env;Variables:{user:AuthUser|null}}>;
export async function loadUser(c: AppContext, next: Next) {
  const token = bearer(c.req.raw);
  if (!token) { c.set("user",null); return next(); }
  const hash = await sha256(token);
  const row = await c.env.DB.prepare(
    `SELECT u.id,u.username,u.display_name,u.avatar_url,u.bio,u.language,u.role,u.status
     FROM ac_sessions s JOIN ac_users u ON u.id=s.user_id
     WHERE s.token_hash=? AND s.expires_at > datetime('now')`
  ).bind(hash).first<AuthUser>();
  c.set("user",row ?? null);
  return next();
}
export function requireUser(c: AppContext): AuthUser {
  const user = c.get("user");
  if (!user) throw new Error("UNAUTHORIZED");
  if (user.status !== "active") throw new Error("SUSPENDED");
  return user;
}
export function requireAdmin(c: AppContext): AuthUser {
  const user = requireUser(c);
  if (user.role !== "admin") throw new Error("FORBIDDEN");
  return user;
}
