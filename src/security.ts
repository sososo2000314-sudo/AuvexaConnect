const enc = new TextEncoder();
export function randomId(): string { return crypto.randomUUID(); }
export function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map(v => v.toString(16).padStart(2,"0")).join("");
}
export async function sha256(value: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(value)));
}
export async function passwordHash(password: string, saltHex: string): Promise<string> {
  const salt = Uint8Array.from(saltHex.match(/.{1,2}/g) ?? [], x => parseInt(x,16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  return toHex(await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations:310000,hash:"SHA-256"},key,256));
}
export function newSalt(): string {
  const b = crypto.getRandomValues(new Uint8Array(16));
  return [...b].map(v=>v.toString(16).padStart(2,"0")).join("");
}
export function bearer(req: Request): string | null {
  const value = req.headers.get("Authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
}
