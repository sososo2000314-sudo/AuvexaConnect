const encoder = new TextEncoder();

export function randomId(bytes = 24) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return [...data].map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map(x => x.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password) {
  const salt = randomId(16);
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: 310000, hash: "SHA-256" }, key, 256);
  const hash = [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$310000$${salt}$${hash}`;
}

export async function verifyPassword(password, saved) {
  if (!saved || !saved.startsWith("pbkdf2$")) return false;
  const [, rounds, salt, expected] = saved.split("$");
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: encoder.encode(salt), iterations: Number(rounds), hash: "SHA-256" }, key, 256);
  const actual = [...new Uint8Array(bits)].map(x => x.toString(16).padStart(2, "0")).join("");
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export function validHandle(handle) { return /^[a-zA-Z0-9_]{3,24}$/.test(handle); }
