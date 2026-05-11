-- Pending TOTP secret for reset flow; activates on first successful login with new code
ALTER TABLE users ADD COLUMN totp_pending_secret TEXT;
