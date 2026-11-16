export interface Env { DB: D1Database; ASSETS: Fetcher; }
export interface AuthUser {
  id: string; username: string; display_name: string; avatar_url: string | null;
  bio: string; language: string; role: "user" | "admin"; status: "active" | "suspended";
}
export type ApiError = { error: string; code: string };
