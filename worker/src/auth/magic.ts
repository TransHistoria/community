// Magic-link token management (stored in D1).

import type { D1Database } from "@cloudflare/workers-types";
import { newId, randomToken } from "@/lib/utils";

const TOKEN_TTL_MINUTES = 30;

/** Create a new magic-link token for `email` and return it. */
export async function createMagicToken(
  db: D1Database,
  email: string,
): Promise<string> {
  // Expire old tokens for this email first
  await db
    .prepare("DELETE FROM magic_tokens WHERE email = ? AND used = 0 AND expires_at < datetime('now')")
    .bind(email)
    .run();

  const token = randomToken(32);
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_MINUTES * 60 * 1000,
  ).toISOString();

  await db
    .prepare(
      "INSERT INTO magic_tokens (id, email, token, expires_at) VALUES (?, ?, ?, ?)",
    )
    .bind(newId(), email, token, expiresAt)
    .run();

  return token;
}

/** Verify a magic-link token; marks it as used. Returns the email or null. */
export async function verifyMagicToken(
  db: D1Database,
  token: string,
): Promise<string | null> {
  const row = await db
    .prepare(
      "SELECT id, email, expires_at, used FROM magic_tokens WHERE token = ?",
    )
    .bind(token)
    .first<{ id: string; email: string; expires_at: string; used: number }>();

  if (!row) return null;
  if (row.used) return null;
  if (new Date(row.expires_at) < new Date()) return null;

  await db
    .prepare("UPDATE magic_tokens SET used = 1 WHERE id = ?")
    .bind(row.id)
    .run();

  return row.email;
}
