-- Migration 0006: 小T system bot user + is_bot column on comments
--
-- 小T is the AI companion who automatically replies to question/help posts
-- after they pass moderation. Comments by 小T are marked is_bot=1 so the
-- frontend can label them as machine-generated.

ALTER TABLE comments ADD COLUMN is_bot INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_comments_is_bot ON comments(is_bot);

-- 小T system user.
-- Stable id so the worker can hardcode it as the bot author.
-- email left as a sentinel (avoids real email collisions and we never send to it).
INSERT INTO users (id, email, handle, display_name, tier, status, email_verified_at, bio, created_at, updated_at)
VALUES (
  'system-xiao-t',
  'system+xiao-t@local',
  'xiao_t',
  '小T',
  'ADMIN',
  'ACTIVE',
  datetime('now'),
  '社群里的 AI 陪伴员。看到提问和求助会先冒个头给个温和回应。我不是医生也不是法律顾问,具体决定还是要你自己来。',
  datetime('now'),
  datetime('now')
);
