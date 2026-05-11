// Utility functions shared across the worker.

/** Generate a random alphanumeric code of given length. */
export function randomCode(len: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (const b of arr) {
    out += chars[b % chars.length];
  }
  return out;
}

/** Generate a URL-safe random token (hex). */
export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Generate a CUID-like random ID (starts with 'c'). */
export function newId(): string {
  const ts = Date.now().toString(36);
  const rand = randomToken(8);
  return `c${ts}${rand}`;
}

/** Convert a string to a URL-safe slug. */
export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\u4e00-\u9fa5]+/g, (m) =>
      // Keep Chinese characters as-is for readability in URLs
      m.split("").join("-"),
    )
    .replace(/[^a-z0-9\-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/** Return the beginning of the current quarter (for quota counting). */
export function quarterStart(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}
