-- Migration 0004: add password-based authentication and auth_mode preference
ALTER TABLE users ADD COLUMN password_hash TEXT;
-- Pending password: set on change/reset, promoted to password_hash on first successful login
ALTER TABLE users ADD COLUMN password_pending_hash TEXT;
ALTER TABLE users ADD COLUMN auth_mode TEXT NOT NULL DEFAULT 'EITHER';
-- auth_mode values:
--   EITHER         — default; either password or TOTP alone is sufficient
--   PASSWORD_ONLY  — only password login accepted
--   TOTP_ONLY      — only TOTP login accepted
--   BOTH_REQUIRED  — both password AND TOTP required in one request
