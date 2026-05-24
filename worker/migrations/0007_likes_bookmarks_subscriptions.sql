-- Migration 0007: likes, bookmarks, subscriptions, and post drafts
--
-- All four are user × X join tables. UNIQUE constraints prevent double-counts
-- (one like per user per post; one bookmark per user per post; one subscription
-- per user per (kind, ref)).
--
-- DRAFT is added by widening the posts.status convention; no DDL change is
-- required since status is a free-form TEXT column already constrained by
-- application logic (PENDING_REVIEW | PUBLISHED | REJECTED | HIDDEN | DRAFT).

CREATE TABLE post_likes (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_post_likes_user ON post_likes(user_id);

CREATE TABLE post_bookmarks (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_id, user_id)
);
CREATE INDEX idx_post_bookmarks_user ON post_bookmarks(user_id);

CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 'AUTHOR' (ref = users.id of the followed author) | 'TAG' (ref = tag string)
  kind TEXT NOT NULL CHECK (kind IN ('AUTHOR', 'TAG')),
  ref TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, kind, ref)
);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_ref ON subscriptions(kind, ref);
