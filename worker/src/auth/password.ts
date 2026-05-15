// PBKDF2-based password hashing using Web Crypto (available in Cloudflare Workers).
// Format: "v1:<iterations>:<salt_b64url>:<hash_b64url>"

const ITERATIONS = 100_000;
const HASH_ALGO = "SHA-256";
const KEY_LENGTH_BYTES = 32;

function b64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return Uint8Array.from(atob(padded + "=".repeat(pad)), (c) => c.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: HASH_ALGO },
    keyMaterial,
    KEY_LENGTH_BYTES * 8,
  );
  return `v1:${ITERATIONS}:${b64urlEncode(salt.buffer)}:${b64urlEncode(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return false;
  const iterations = parseInt(parts[1] ?? "", 10);
  if (!iterations || iterations <= 0) return false;
  const saltStr = parts[2];
  const hashStr = parts[3];
  if (!saltStr || !hashStr) return false;
  const salt = b64urlDecode(saltStr);
  const expected = b64urlDecode(hashStr);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derived = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: HASH_ALGO },
      keyMaterial,
      expected.byteLength * 8,
    ),
  );
  if (derived.length !== expected.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i]! ^ expected[i]!;
  return diff === 0;
}

const PASSWORD_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CHARS_LEN = PASSWORD_CHARS.length; // 57

// Rejection sampling: discard bytes that would produce modulo bias.
// Largest multiple of CHARS_LEN that fits in a byte (0-255).
const BYTE_CAP = Math.floor(256 / CHARS_LEN) * CHARS_LEN; // 228

export function generateRandomPassword(length = 16): string {
  let result = "";
  while (result.length < length) {
    const bytes = crypto.getRandomValues(new Uint8Array(length * 3));
    for (const byte of bytes) {
      if (result.length >= length) break;
      if (byte >= BYTE_CAP) continue; // reject to eliminate bias
      result += PASSWORD_CHARS[byte % CHARS_LEN];
    }
  }
  return result;
}
