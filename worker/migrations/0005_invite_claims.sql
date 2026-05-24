-- Migration 0005: persist invite prechecks and consume them on auth/verify
CREATE TABLE IF NOT EXISTS invite_claims (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code TEXT NOT NULL REFERENCES invite_codes(code) ON DELETE CASCADE,
  issuer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT,
  consumed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_invite_claims_email_consumed
  ON invite_claims(email, consumed_at, created_at);

CREATE INDEX IF NOT EXISTS idx_invite_claims_code
  ON invite_claims(code);
