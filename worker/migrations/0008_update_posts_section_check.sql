-- Migration 0008: Update posts section CHECK to match the new taxonomy
-- (QUESTION, OFFLINE_MEETUP, MEDICAL, RESOURCE, REFLECTION + legacy POST)

CREATE TABLE posts_new (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  section TEXT NOT NULL CHECK (section IN ('POST','QUESTION','OFFLINE_MEETUP','MEDICAL','RESOURCE','REFLECTION')),
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

INSERT INTO posts_new SELECT * FROM posts;

DROP TABLE posts;
ALTER TABLE posts_new RENAME TO posts;

CREATE INDEX idx_posts_section_status ON posts(section, status);
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_hospital ON posts(hospital);
CREATE INDEX idx_posts_created_at ON posts(created_at);