// Posts API routes — three sections (POST/MEDICAL/RESOURCE) plus comments.
// Every create/update goes through containsBlockedTerms (cheap) then moderateAndClassify (LLM).
// LLM decides final section + verdict; section mismatches and tier-incompatible content are rejected.

import { Hono } from "hono";
import type { Env, Variables, PostRow, CommentRow } from "@/types";
import { requireAuth, optionalAuth, requireTier } from "@/middleware/auth";
import { meetsVisibility } from "@/lib/access";
import { newId } from "@/lib/utils";
import { TIER_RANK } from "@/lib/enums";
import { moderateAndClassify, type ModerationDecision } from "@/lib/llm";
import { containsBlockedTerms } from "@/lib/keywords";

const posts = new Hono<{ Bindings: Env; Variables: Variables }>();

const VALID_SECTIONS = ["POST", "MEDICAL", "RESOURCE"] as const;
type PostSection = (typeof VALID_SECTIONS)[number];

const VALID_VISIBILITY = ["PUBLIC", "VERIFIED", "TRUSTED"] as const;

// ---- helpers ----

function viewerFrom(c: { get: (k: string) => string | undefined }) {
  const userId = c.get("userId");
  const userTier = c.get("userTier");
  if (!userId) return null;
  return { id: userId, tier: userTier ?? "GUEST" };
}

function rank(tier: string): number {
  return TIER_RANK[tier] ?? 0;
}

function buildVisibilityCondition(viewer: { id: string; tier: string } | null): string {
  if (!viewer) return "p.visibility = 'PUBLIC'";
  if (rank(viewer.tier) >= rank("TRUSTED")) return "1=1";
  if (rank(viewer.tier) >= rank("VERIFIED"))
    return "(p.visibility IN ('PUBLIC','VERIFIED') OR p.author_id = '" + viewer.id + "')";
  return "(p.visibility = 'PUBLIC' OR p.author_id = '" + viewer.id + "')";
}

async function audit(
  db: D1Database,
  actorId: string,
  action: string,
  targetType: string,
  targetId: string,
  meta?: object,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, meta) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(newId(), actorId, action, targetType, targetId, meta ? JSON.stringify(meta) : null)
    .run();
}

function statusFromVerdict(verdict: ModerationDecision["verdict"]): string {
  if (verdict === "pass") return "PUBLISHED";
  if (verdict === "flag") return "PENDING_REVIEW";
  return "REJECTED";
}

// ---- Posts CRUD ----

// GET /api/posts — list (filtered by section/hospital/q/page)
posts.get("/", optionalAuth, async (c) => {
  const viewer = viewerFrom(c);
  const { section, hospital, doctor, city, q, page = "1" } = c.req.query();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limit = 30;
  const offset = (pageNum - 1) * limit;

  const conditions: string[] = [
    buildVisibilityCondition(viewer),
    // Show PUBLISHED to everyone, plus the author's own non-published rows.
    viewer
      ? `(p.status = 'PUBLISHED' OR p.author_id = '${viewer.id}' OR ? = 'ADMIN')`
      : "p.status = 'PUBLISHED'",
  ];
  const params: unknown[] = [];
  if (viewer) params.push(viewer.tier);

  if (section && (VALID_SECTIONS as readonly string[]).includes(section)) {
    conditions.push("p.section = ?");
    params.push(section);
  }
  if (hospital) {
    conditions.push("p.hospital LIKE ?");
    params.push(`%${hospital}%`);
  }
  if (doctor) {
    conditions.push("p.doctor LIKE ?");
    params.push(`%${doctor}%`);
  }
  if (city) {
    conditions.push("p.city LIKE ?");
    params.push(`%${city}%`);
  }
  if (q) {
    conditions.push("(p.title LIKE ? OR p.body LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.join(" AND ");
  const rows = await c.env.DB.prepare(
    `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name, u.avatar_url AS author_avatar,
       (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id AND c.is_hidden = 0) AS comment_count
     FROM posts p
     JOIN users u ON u.id = p.author_id
     WHERE ${where}
     ORDER BY p.created_at DESC
     LIMIT ? OFFSET ?`,
  )
    .bind(...params, limit, offset)
    .all<PostRow & { author_handle: string; author_name: string; author_avatar: string | null; comment_count: number }>();

  return c.json({ posts: rows.results });
});

// GET /api/posts/:id — detail
posts.get("/:id", optionalAuth, async (c) => {
  const viewer = viewerFrom(c);
  const { id } = c.req.param();

  const post = await c.env.DB.prepare(
    `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name, u.avatar_url AS author_avatar
     FROM posts p JOIN users u ON u.id = p.author_id
     WHERE p.id = ?`,
  )
    .bind(id)
    .first<PostRow & { author_handle: string; author_name: string; author_avatar: string | null }>();

  if (!post) return c.json({ error: "帖子不存在" }, 404);

  // Status gate: non-PUBLISHED only visible to author and admin.
  if (post.status !== "PUBLISHED") {
    const isAuthor = viewer?.id === post.author_id;
    const isAdmin = viewer?.tier === "ADMIN";
    if (!isAuthor && !isAdmin) return c.json({ error: "帖子不存在" }, 404);
  }

  // Visibility gate
  if (!meetsVisibility(viewer, post.visibility) && viewer?.id !== post.author_id && viewer?.tier !== "ADMIN") {
    return c.json({ error: "无权访问" }, 403);
  }

  const canEdit = !!viewer && (viewer.id === post.author_id || viewer.tier === "ADMIN");
  return c.json({ post: { ...post, canEdit } });
});

// POST /api/posts — create (LLM-moderated)
posts.post("/", requireAuth, requireTier("VERIFIED"), async (c) => {
  const viewer = viewerFrom(c)!;

  const body = await c.req.json<{
    section: PostSection;
    title: string;
    body: string;
    tags?: string[];
    hospital?: string;
    doctor?: string;
    city?: string;
    resourceKind?: "OFFER" | "REQUEST";
    coverUrl?: string;
    visibility?: string;
  }>();

  if (!body.title?.trim() || !body.body?.trim() || !body.section) {
    return c.json({ error: "缺少必填字段" }, 400);
  }
  const title = body.title.trim().slice(0, 200);
  const text = body.body.trim();
  if (title.length < 2) return c.json({ error: "标题太短" }, 400);
  if (text.length < 5) return c.json({ error: "正文太短" }, 400);
  if (text.length > 20000) return c.json({ error: "正文过长" }, 400);

  if (!(VALID_SECTIONS as readonly string[]).includes(body.section)) {
    return c.json({ error: "板块无效" }, 400);
  }
  const visibility = body.visibility && (VALID_VISIBILITY as readonly string[]).includes(body.visibility)
    ? body.visibility
    : "VERIFIED";

  if (body.section === "RESOURCE" && body.resourceKind && !["OFFER", "REQUEST"].includes(body.resourceKind)) {
    return c.json({ error: "resourceKind 无效" }, 400);
  }

  // 1) Cheap keyword guard — short-circuit if obvious.
  if (containsBlockedTerms(`${title}\n${text}`)) {
    return c.json({
      error: "内容包含被屏蔽的词汇",
      reason: "命中关键词过滤，请修改后再试",
      moderation: { verdict: "reject", classifier: "KEYWORD" },
    }, 400);
  }

  // 2) LLM moderation + classification.
  const decision = await moderateAndClassify(c.env, {
    kind: "POST",
    title,
    body: text,
    hintSection: body.section,
    authorTier: viewer.tier,
  });

  // 3) Reject pre-checks: cross-section EVENT or hard reject.
  if (decision.section === "EVENT" && rank(viewer.tier) < rank("TRUSTED")) {
    return c.json({
      error: "内容更像是一个活动，建议联系信任成员发起活动",
      reason: decision.reason,
      moderation: decision,
    }, 400);
  }
  if (decision.verdict === "reject") {
    return c.json({ error: decision.reason || "内容不符合社区规范", moderation: decision }, 400);
  }

  // Use LLM's section override if it disagrees and the new section is one we support.
  const finalSection =
    decision.section === "EVENT"
      ? body.section // EVENT not allowed in posts; fall back to user's choice (decision already non-reject)
      : (decision.section as PostSection);

  const status = statusFromVerdict(decision.verdict);
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO posts (
       id, author_id, section, title, body, tags,
       hospital, doctor, city, resource_kind, cover_url,
       visibility, status,
       moderation_verdict, moderation_reason, moderation_categories, moderation_raw,
       moderation_classifier, moderated_at
     ) VALUES (?,?,?,?,?,?, ?,?,?,?,?, ?,?, ?,?,?,?, ?, datetime('now'))`,
  )
    .bind(
      id,
      viewer.id,
      finalSection,
      title,
      text,
      JSON.stringify(body.tags ?? []),
      body.hospital?.trim() || null,
      body.doctor?.trim() || null,
      body.city?.trim() || null,
      finalSection === "RESOURCE" ? body.resourceKind ?? null : null,
      body.coverUrl ?? null,
      visibility,
      status,
      decision.verdict,
      decision.reason,
      JSON.stringify(decision.categories),
      decision.raw,
      decision.classifier,
    )
    .run();

  await audit(c.env.DB, viewer.id, "POST_CREATE", "Post", id, {
    section: finalSection,
    verdict: decision.verdict,
    status,
  });

  return c.json({ ok: true, id, status, moderation: decision });
});

// PATCH /api/posts/:id — edit (re-runs LLM)
posts.patch("/:id", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?")
    .bind(id)
    .first<PostRow>();
  if (!post) return c.json({ error: "帖子不存在" }, 404);

  const isAuthor = post.author_id === viewer.id;
  const isAdmin = viewer.tier === "ADMIN";
  if (!isAuthor && !isAdmin) return c.json({ error: "无权编辑" }, 403);

  const body = await c.req.json<{
    title?: string;
    body?: string;
    tags?: string[];
    hospital?: string | null;
    doctor?: string | null;
    city?: string | null;
    resourceKind?: "OFFER" | "REQUEST" | null;
    coverUrl?: string | null;
    visibility?: string;
  }>();

  const nextTitle = (body.title ?? post.title).trim();
  const nextText = (body.body ?? post.body).trim();
  if (nextTitle.length < 2 || nextText.length < 5) {
    return c.json({ error: "标题或正文太短" }, 400);
  }

  if (containsBlockedTerms(`${nextTitle}\n${nextText}`)) {
    return c.json({ error: "内容包含被屏蔽的词汇" }, 400);
  }

  const decision = await moderateAndClassify(c.env, {
    kind: "POST",
    title: nextTitle,
    body: nextText,
    hintSection: post.section as "POST" | "MEDICAL" | "RESOURCE",
    authorTier: viewer.tier,
  });

  if (decision.verdict === "reject") {
    return c.json({ error: decision.reason || "内容不符合社区规范", moderation: decision }, 400);
  }

  const nextStatus = isAdmin ? post.status : statusFromVerdict(decision.verdict);
  const nextVisibility = body.visibility && (VALID_VISIBILITY as readonly string[]).includes(body.visibility)
    ? body.visibility
    : post.visibility;

  await c.env.DB.prepare(
    `UPDATE posts SET
       title = ?,
       body = ?,
       tags = COALESCE(?, tags),
       hospital = ?,
       doctor = ?,
       city = ?,
       resource_kind = ?,
       cover_url = ?,
       visibility = ?,
       status = ?,
       moderation_verdict = ?,
       moderation_reason = ?,
       moderation_categories = ?,
       moderation_raw = ?,
       moderation_classifier = ?,
       moderated_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      nextTitle,
      nextText,
      body.tags ? JSON.stringify(body.tags) : null,
      body.hospital !== undefined ? (body.hospital?.trim() || null) : post.hospital,
      body.doctor !== undefined ? (body.doctor?.trim() || null) : post.doctor,
      body.city !== undefined ? (body.city?.trim() || null) : post.city,
      body.resourceKind !== undefined ? body.resourceKind : post.resource_kind,
      body.coverUrl !== undefined ? body.coverUrl : post.cover_url,
      nextVisibility,
      nextStatus,
      decision.verdict,
      decision.reason,
      JSON.stringify(decision.categories),
      decision.raw,
      decision.classifier,
      id,
    )
    .run();

  await audit(c.env.DB, viewer.id, "POST_UPDATE", "Post", id, {
    verdict: decision.verdict,
    status: nextStatus,
  });

  return c.json({ ok: true, status: nextStatus, moderation: decision });
});

// DELETE /api/posts/:id
posts.delete("/:id", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  const post = await c.env.DB.prepare("SELECT author_id FROM posts WHERE id = ?")
    .bind(id)
    .first<{ author_id: string }>();
  if (!post) return c.json({ error: "帖子不存在" }, 404);

  if (post.author_id !== viewer.id && viewer.tier !== "ADMIN") {
    return c.json({ error: "无权操作" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(id).run();
  await audit(c.env.DB, viewer.id, "POST_DELETE", "Post", id);
  return c.json({ ok: true });
});

// ---- Comments on posts ----

// GET /api/posts/:id/comments
posts.get("/:id/comments", optionalAuth, async (c) => {
  const viewer = viewerFrom(c);
  const { id } = c.req.param();

  const rows = await c.env.DB.prepare(
    `SELECT c.*, u.handle AS author_handle, u.display_name AS author_name, u.avatar_url AS author_avatar
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.post_id = ? AND (c.is_hidden = 0 OR ? = 1)
     ORDER BY c.created_at ASC`,
  )
    .bind(id, viewer?.tier === "ADMIN" ? 1 : 0)
    .all<CommentRow & { author_handle: string; author_name: string; author_avatar: string | null }>();

  return c.json({ comments: rows.results });
});

// POST /api/posts/:id/comments — LLM-moderated
posts.post("/:id/comments", requireAuth, requireTier("VERIFIED"), async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  const post = await c.env.DB.prepare("SELECT id, status FROM posts WHERE id = ?")
    .bind(id)
    .first<{ id: string; status: string }>();
  if (!post) return c.json({ error: "帖子不存在" }, 404);
  if (post.status !== "PUBLISHED") return c.json({ error: "帖子尚未发布" }, 400);

  const body = await c.req.json<{ body: string; parentId?: string }>();
  const text = (body.body ?? "").trim();
  if (!text) return c.json({ error: "评论不能为空" }, 400);
  if (text.length > 4000) return c.json({ error: "评论过长" }, 400);

  if (containsBlockedTerms(text)) {
    return c.json({ error: "评论包含被屏蔽的词汇" }, 400);
  }

  const decision = await moderateAndClassify(c.env, {
    kind: "COMMENT",
    body: text,
    authorTier: viewer.tier,
  });

  if (decision.verdict === "reject") {
    return c.json({ error: decision.reason || "评论不符合社区规范", moderation: decision }, 400);
  }

  const hidden = decision.verdict === "flag" ? 1 : 0;
  const cid = newId();
  await c.env.DB.prepare(
    `INSERT INTO comments (id, event_id, post_id, author_id, body, parent_id, is_hidden, hidden_reason)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(cid, id, viewer.id, text, body.parentId ?? null, hidden, hidden ? decision.reason : null)
    .run();

  return c.json({ ok: true, id: cid, hidden: !!hidden, moderation: decision });
});

// PATCH /api/posts/comments/:cid/hide — post author or admin
posts.patch("/comments/:cid/hide", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { cid } = c.req.param();

  const comment = await c.env.DB.prepare(
    `SELECT c.*, p.author_id AS post_author_id
     FROM comments c JOIN posts p ON p.id = c.post_id
     WHERE c.id = ?`,
  )
    .bind(cid)
    .first<CommentRow & { post_author_id: string }>();

  if (!comment) return c.json({ error: "评论不存在" }, 404);

  const isAuthor = comment.post_author_id === viewer.id;
  if (!isAuthor && viewer.tier !== "ADMIN") return c.json({ error: "无权操作" }, 403);

  const reason = viewer.tier === "ADMIN" ? "管理员处理" : "作者处理";
  await c.env.DB.prepare(
    "UPDATE comments SET is_hidden = 1, hidden_reason = ? WHERE id = ?",
  )
    .bind(reason, cid)
    .run();

  return c.json({ ok: true });
});

// ---- Admin review queue ----

// GET /api/posts/admin/pending — list PENDING_REVIEW posts (admin only)
posts.get("/admin/pending", requireAuth, requireTier("ADMIN"), async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT p.*, u.handle AS author_handle, u.display_name AS author_name
     FROM posts p JOIN users u ON u.id = p.author_id
     WHERE p.status = 'PENDING_REVIEW'
     ORDER BY p.created_at DESC
     LIMIT 100`,
  )
    .all<PostRow & { author_handle: string; author_name: string }>();
  return c.json({ posts: rows.results });
});

// PATCH /api/posts/:id/review — admin approves or rejects a pending post
posts.patch("/:id/review", requireAuth, requireTier("ADMIN"), async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();
  const body = await c.req.json<{ decision: "APPROVE" | "REJECT" | "HIDE"; note?: string }>();

  const post = await c.env.DB.prepare("SELECT id, status FROM posts WHERE id = ?")
    .bind(id)
    .first<{ id: string; status: string }>();
  if (!post) return c.json({ error: "帖子不存在" }, 404);

  let nextStatus = post.status;
  if (body.decision === "APPROVE") nextStatus = "PUBLISHED";
  else if (body.decision === "REJECT") nextStatus = "REJECTED";
  else if (body.decision === "HIDE") nextStatus = "HIDDEN";
  else return c.json({ error: "decision 无效" }, 400);

  await c.env.DB.prepare(
    `UPDATE posts SET
       status = ?,
       moderation_classifier = 'MANUAL',
       moderation_reason = COALESCE(?, moderation_reason),
       reviewed_by_id = ?,
       reviewed_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(nextStatus, body.note ?? null, viewer.id, id)
    .run();

  await audit(c.env.DB, viewer.id, "POST_REVIEW", "Post", id, {
    decision: body.decision,
    nextStatus,
  });

  return c.json({ ok: true, status: nextStatus });
});

export default posts;
