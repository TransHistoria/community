-- Migration 0005: posts module (POST/MEDICAL/RESOURCE sections) + LLM moderation columns
-- New table: posts — unified backing for general posts, medical-info sharing, and resource sharing.
-- Comments rebuilt: add nullable post_id, relax event_id to NULL so the same comments table
--   serves events and posts (application enforces XOR).
-- Events extended: moderation result columns mirror the posts model.

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  section TEXT NOT NULL CHECK (section IN ('POST','MEDICAL','RESOURCE')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  hospital TEXT,
  doctor TEXT,
  city TEXT,
  resource_kind TEXT,
  cover_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'VERIFIED',
  status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  moderation_verdict TEXT,
  moderation_reason TEXT,
  moderation_categories TEXT,
  moderation_raw TEXT,
  moderation_classifier TEXT,
  moderated_at TEXT,
  reviewed_by_id TEXT REFERENCES users(id),
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_posts_section_status ON posts(section, status);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_hospital ON posts(hospital);
CREATE INDEX idx_posts_created_at ON posts(created_at);

-- Rebuild comments table so it can polymorphically reference either an event or a post.
-- SQLite can't drop NOT NULL on an existing column, so we copy data through a new table.
CREATE TABLE comments_new (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id) ON DELETE CASCADE,
  post_id TEXT REFERENCES posts(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  parent_id TEXT REFERENCES comments_new(id) ON DELETE CASCADE,
  is_hidden INTEGER NOT NULL DEFAULT 0,
  hidden_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO comments_new (id, event_id, post_id, author_id, body, parent_id, is_hidden, hidden_reason, created_at)
SELECT id, event_id, NULL, author_id, body, parent_id, is_hidden, hidden_reason, created_at FROM comments;

DROP TABLE comments;
ALTER TABLE comments_new RENAME TO comments;
CREATE INDEX idx_comments_event ON comments(event_id);
CREATE INDEX idx_comments_post ON comments(post_id);
CREATE INDEX idx_comments_author ON comments(author_id);

-- Events: moderation result columns (parallel to posts).
ALTER TABLE events ADD COLUMN moderation_verdict TEXT;
ALTER TABLE events ADD COLUMN moderation_reason TEXT;
ALTER TABLE events ADD COLUMN moderation_categories TEXT;
ALTER TABLE events ADD COLUMN moderation_raw TEXT;
ALTER TABLE events ADD COLUMN moderation_classifier TEXT;
ALTER TABLE events ADD COLUMN moderated_at TEXT;
ALTER TABLE events ADD COLUMN reviewed_by_id TEXT REFERENCES users(id);
ALTER TABLE events ADD COLUMN reviewed_at TEXT;
