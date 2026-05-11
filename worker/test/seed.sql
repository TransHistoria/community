-- Test fixture data for API integration tests.
-- Applied against the local D1 database before wrangler dev starts.
-- All tokens expire 1 hour from now (SQLite datetime arithmetic).

-- ── Users ──────────────────────────────────────────────────────────────────

INSERT INTO users
  (id, email, handle, display_name, tier, status, email_verified_at)
VALUES
  ('ci-admin',     'admin@ci.test',     'ci_admin',     'CI Admin',     'ADMIN',    'ACTIVE', datetime('now')),
  ('ci-verified',  'verified@ci.test',  'ci_verified',  'CI Verified',  'VERIFIED', 'ACTIVE', datetime('now')),
  ('ci-user2',     'user2@ci.test',     'ci_user2',     'CI User2',     'VERIFIED', 'ACTIVE', datetime('now'));

-- ── Magic-link tokens (known values so the test script can call /verify) ──

INSERT INTO magic_tokens (id, email, token, expires_at, used)
VALUES
  ('mt-admin',    'admin@ci.test',    'ci-token-admin',    datetime('now', '+1 hour'), 0),
  ('mt-verified', 'verified@ci.test', 'ci-token-verified', datetime('now', '+1 hour'), 0),
  ('mt-user2',    'user2@ci.test',    'ci-token-user2',    datetime('now', '+1 hour'), 0);

-- ── Pre-existing invite code (so verify-invite can be tested before POST /invites) ──

INSERT INTO invite_codes (code, issuer_id, max_uses, used_count)
VALUES ('CI-SEED-CODE', 'ci-admin', 5, 0);
