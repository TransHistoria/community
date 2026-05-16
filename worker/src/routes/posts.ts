// Posts API — single "广场" feed, LLM moderation + auto-classification.
//
// Flow per create/update:
//   1. Cheap keyword backstop. Hit -> save as REJECTED + notify, return 200.
//   2. LLM moderation (with retry). Verdict drives status:
//        pass -> PUBLISHED + light notification (no email)
//        flag -> PENDING_REVIEW + notification + email
//        reject -> REJECTED + notification + email
//   3. If pass + tags contains question/resource-request -> kick off 小T reply
//      (best-effort, fire-and-forget). Generates a comment authored by the
//      system user 'system-xiao-t' with is_bot=1.
//
// The frontend never sees the LLM verdict. POST returns { ok, id, status }.
// Users learn the outcome via /notifications (always) + email (for flag/reject).

import { Hono } from "hono";
import type { Env, Variables, PostRow, CommentRow } from "@/types";
import { requireAuth, optionalAuth, requireTier } from "@/middleware/auth";
import { meetsVisibility } from "@/lib/access";
import { newId } from "@/lib/utils";
import { TIER_RANK } from "@/lib/enums";
import {
  moderateAndClassify,
  generateXiaoTReply,
  type ModerationDecision,
} from "@/lib/llm";
import { containsBlockedTerms } from "@/lib/keywords";
import { sendModerationStatusEmail } from "@/email/sender";

const posts = new Hono<{ Bindings: Env; Variables: Variables }>();

const XIAO_T_USER_ID = "system-xiao-t";
const TAGS_THAT_TRIGGER_XIAO_T = new Set(["question-help", "resource-request"]);

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

async function notify(
  db: D1Database,
  userId: string,
  kind: string,
  payload: object,
): Promise<void> {
  await db
    .prepare("INSERT INTO notifications (id, user_id, kind, payload) VALUES (?, ?, ?, ?)")
    .bind(newId(), userId, kind, JSON.stringify(payload))
    .run();
}

function statusForVerdict(verdict: ModerationDecision["verdict"]): string {
  if (verdict === "pass") return "PUBLISHED";
  if (verdict === "flag") return "PENDING_REVIEW";
  return "REJECTED";
}

// LLM may return POST/MEDICAL/RESOURCE for the posts table. EVENT is handled
// separately because activities have a dedicated /api/activities route and a
// tier gate; we don't silently demote them to posts here.
function normalizePostSection(decisionSection: string): "POST" | "MEDICAL" | "RESOURCE" {
  if (decisionSection === "MEDICAL" || decisionSection === "RESOURCE") return decisionSection;
  return "POST";
}

async function notifyModerationOutcome(
  env: Env,
  authorEmail: string | null,
  postId: string,
  title: string,
  status: string,
  reason: string,
): Promise<void> {
  if (status === "PENDING_REVIEW" || status === "REJECTED") {
    if (authorEmail) {
      try {
        await sendModerationStatusEmail(
          { sendEmail: env.SEND_EMAIL, from: env.EMAIL_FROM, appName: env.APP_NAME },
          {
            to: authorEmail,
            title,
            url: `${env.FRONTEND_URL}/posts/${postId}`,
            status: status as "PENDING_REVIEW" | "REJECTED",
            targetKind: "POST",
            reason,
          },
        );
      } catch (err) {
        // Email is best-effort; the in-app notification is the canonical channel.
        console.error("sendModerationStatusEmail failed:", err);
      }
    }
  }
}

async function spawnXiaoTReply(
  env: Env,
  postId: string,
  post: { title: string; body: string },
  authorId: string,
): Promise<void> {
  const reply = await generateXiaoTReply(env, post);
  if (!reply) return;
  const cid = newId();
  await env.DB.prepare(
    `INSERT INTO comments (id, event_id, post_id, author_id, body, parent_id, is_hidden, hidden_reason, is_bot)
     VALUES (?, NULL, ?, ?, ?, NULL, 0, NULL, 1)`,
  )
    .bind(cid, postId, XIAO_T_USER_ID, reply)
    .run();
  await notify(env.DB, authorId, "XIAO_T_REPLIED", {
    postId,
    title: post.title,
    commentId: cid,
  });
}

// ---- Posts CRUD ----

// GET /api/posts — list (filter by tag, hospital, city, q)
posts.get("/", optionalAuth, async (c) => {
  const viewer = viewerFrom(c);
  const { tag, section, hospital, doctor, city, q, page = "1" } = c.req.query();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limit = 30;
  const offset = (pageNum - 1) * limit;

  const conditions: string[] = [
    buildVisibilityCondition(viewer),
    viewer
      ? `(p.status = 'PUBLISHED' OR p.author_id = '${viewer.id}' OR ? = 'ADMIN')`
      : "p.status = 'PUBLISHED'",
  ];
  const params: unknown[] = [];
  if (viewer) params.push(viewer.tier);

  if (tag) {
    // tags is a JSON array stored as text; quick substring match is fine for
    // the small expected dataset. Indexed search would need FTS5.
    conditions.push("p.tags LIKE ?");
    params.push(`%"${tag}"%`);
  }
  if (section) {
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

  // Redact moderation fields except for admin viewers — non-admin clients
  // should never see the raw LLM rationale.
  const redact = viewer?.tier !== "ADMIN";
  const items = redact
    ? rows.results.map((p) => ({
        ...p,
        moderation_raw: null,
        moderation_categories: null,
      }))
    : rows.results;

  return c.json({ posts: items });
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

  // Visibility gate
  const isAuthor = viewer?.id === post.author_id;
  const isAdmin = viewer?.tier === "ADMIN";

  if (post.status !== "PUBLISHED" && !isAuthor && !isAdmin) {
    return c.json({ error: "帖子不存在" }, 404);
  }
  if (!meetsVisibility(viewer, post.visibility) && !isAuthor && !isAdmin) {
    return c.json({ error: "无权访问" }, 403);
  }

  const safe = isAdmin
    ? post
    : { ...post, moderation_raw: null, moderation_categories: null };

  return c.json({
    post: {
      ...safe,
      canEdit: isAuthor || isAdmin,
    },
  });
});

// POST /api/posts — create (LLM-driven; always returns 200)
posts.post("/", requireAuth, requireTier("VERIFIED"), async (c) => {
  const viewer = viewerFrom(c)!;

  const body = await c.req.json<{
    title: string;
    body: string;
    visibility?: string;
  }>();
  const title = (body.title ?? "").trim().slice(0, 200);
  const text = (body.body ?? "").trim();
  if (title.length < 2 || text.length < 5) {
    return c.json({ error: "标题或正文太短" }, 400);
  }
  if (text.length > 20000) return c.json({ error: "正文过长" }, 400);

  const visibility = ["PUBLIC", "VERIFIED", "TRUSTED"].includes(body.visibility ?? "")
    ? body.visibility!
    : "VERIFIED";

  const id = newId();

  // Fetch author email up-front so we can notify even on keyword reject path.
  const author = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?")
    .bind(viewer.id)
    .first<{ email: string }>();
  const authorEmail = author?.email ?? null;

  // 1) Keyword backstop — write as REJECTED + notify + return 200.
  if (containsBlockedTerms(`${title}\n${text}`)) {
    const reason = "命中关键词过滤,请修改内容后重新发布。";
    await c.env.DB.prepare(
      `INSERT INTO posts (id, author_id, section, title, body, visibility, status,
         moderation_verdict, moderation_reason, moderation_classifier, moderated_at)
       VALUES (?, ?, 'POST', ?, ?, ?, 'REJECTED', 'reject', ?, 'KEYWORD', datetime('now'))`,
    )
      .bind(id, viewer.id, title, text, visibility, reason)
      .run();
    await notify(c.env.DB, viewer.id, "POST_REJECTED", {
      postId: id,
      title,
      reason,
      status: "REJECTED",
    });
    await notifyModerationOutcome(c.env, authorEmail, id, title, "REJECTED", reason);
    await audit(c.env.DB, viewer.id, "POST_CREATE", "Post", id, { verdict: "reject", classifier: "KEYWORD" });
    return c.json({ ok: true, id, status: "REJECTED" });
  }

  // 2) LLM moderation + classification.
  const decision = await moderateAndClassify(c.env, {
    kind: "POST",
    title,
    body: text,
    authorTier: viewer.tier,
  });

  // Activities are gated separately. If the LLM says this content is really an
  // EVENT, reject the post and point the author at the activities flow.
  // (Auto-classification still happens *within* POST/MEDICAL/RESOURCE — LLM
  // decides which of those three the content belongs to.)
  let finalVerdict = decision.verdict;
  let finalReason = decision.reason;
  if (decision.section === "EVENT") {
    finalVerdict = "reject";
    finalReason = rank(viewer.tier) >= rank("TRUSTED")
      ? "内容看起来是要组织活动,请去活动模块发布。"
      : "内容看起来是要组织活动。社群活动需要由 TRUSTED 及以上成员发起,你可以联系组织者代发。";
  }
  const section = normalizePostSection(decision.section);
  const status = statusForVerdict(finalVerdict);

  await c.env.DB.prepare(
    `INSERT INTO posts (
       id, author_id, section, title, body, tags, visibility, status,
       moderation_verdict, moderation_reason, moderation_categories, moderation_raw,
       moderation_classifier, moderated_at
     ) VALUES (?,?,?,?,?,?,?,?, ?,?,?,?,?, datetime('now'))`,
  )
    .bind(
      id,
      viewer.id,
      section,
      title,
      text,
      JSON.stringify(decision.tags),
      visibility,
      status,
      finalVerdict,
      finalReason,
      JSON.stringify(decision.categories),
      decision.raw,
      decision.classifier,
    )
    .run();

  // Notification (always) + email (for flag/reject).
  const kind =
    status === "PUBLISHED"
      ? "POST_APPROVED"
      : status === "PENDING_REVIEW"
        ? "POST_PENDING_REVIEW"
        : "POST_REJECTED";
  await notify(c.env.DB, viewer.id, kind, {
    postId: id,
    title,
    reason: finalReason,
    status,
    section,
  });
  await notifyModerationOutcome(c.env, authorEmail, id, title, status, finalReason);

  await audit(c.env.DB, viewer.id, "POST_CREATE", "Post", id, {
    verdict: finalVerdict,
    section,
    tags: decision.tags,
    status,
  });

  // 3) Fire-and-forget 小T auto-reply for question/help posts that passed.
  if (status === "PUBLISHED" && decision.tags.some((t) => TAGS_THAT_TRIGGER_XIAO_T.has(t))) {
    c.executionCtx.waitUntil(
      spawnXiaoTReply(c.env, id, { title, body: text }, viewer.id).catch((err) =>
        console.error("xiao-T reply failed:", err),
      ),
    );
  }

  return c.json({ ok: true, id, status });
});

// PATCH /api/posts/:id — edit, re-runs LLM
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
    visibility?: string;
  }>();

  const nextTitle = (body.title ?? post.title).trim();
  const nextText = (body.body ?? post.body).trim();
  if (nextTitle.length < 2 || nextText.length < 5) {
    return c.json({ error: "标题或正文太短" }, 400);
  }

  const author = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?")
    .bind(post.author_id)
    .first<{ email: string }>();
  const authorEmail = author?.email ?? null;

  if (containsBlockedTerms(`${nextTitle}\n${nextText}`)) {
    const reason = "命中关键词过滤,请修改内容后重新发布。";
    await c.env.DB.prepare(
      `UPDATE posts SET title=?, body=?, status='REJECTED',
         moderation_verdict='reject', moderation_reason=?, moderation_classifier='KEYWORD',
         moderated_at=datetime('now'), updated_at=datetime('now')
       WHERE id=?`,
    )
      .bind(nextTitle, nextText, reason, id)
      .run();
    await notify(c.env.DB, post.author_id, "POST_REJECTED", {
      postId: id,
      title: nextTitle,
      reason,
      status: "REJECTED",
    });
    await notifyModerationOutcome(c.env, authorEmail, id, nextTitle, "REJECTED", reason);
    return c.json({ ok: true, status: "REJECTED" });
  }

  const decision = await moderateAndClassify(c.env, {
    kind: "POST",
    title: nextTitle,
    body: nextText,
    authorTier: viewer.tier,
  });

  let finalVerdict = decision.verdict;
  let finalReason = decision.reason;
  if (decision.section === "EVENT") {
    finalVerdict = "reject";
    finalReason = "修改后的内容像是要组织活动,请去活动模块或恢复原帖。";
  }
  const section = normalizePostSection(decision.section);
  const status = isAdmin ? post.status : statusForVerdict(finalVerdict);

  const nextVisibility = body.visibility && ["PUBLIC", "VERIFIED", "TRUSTED"].includes(body.visibility)
    ? body.visibility
    : post.visibility;

  await c.env.DB.prepare(
    `UPDATE posts SET
       title = ?, body = ?, section = ?, tags = ?, visibility = ?, status = ?,
       moderation_verdict = ?, moderation_reason = ?, moderation_categories = ?,
       moderation_raw = ?, moderation_classifier = ?, moderated_at = datetime('now'),
       updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      nextTitle,
      nextText,
      section,
      JSON.stringify(decision.tags),
      nextVisibility,
      status,
      finalVerdict,
      finalReason,
      JSON.stringify(decision.categories),
      decision.raw,
      decision.classifier,
      id,
    )
    .run();

  const kind =
    status === "PUBLISHED"
      ? "POST_APPROVED"
      : status === "PENDING_REVIEW"
        ? "POST_PENDING_REVIEW"
        : "POST_REJECTED";
  await notify(c.env.DB, post.author_id, kind, {
    postId: id,
    title: nextTitle,
    reason: finalReason,
    status,
    section,
  });
  await notifyModerationOutcome(c.env, authorEmail, id, nextTitle, status, finalReason);

  return c.json({ ok: true, status });
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

// POST /api/posts/:id/comments — LLM-moderated, never returns moderation detail
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
    return c.json({ error: decision.reason || "评论不符合社区规范" }, 400);
  }

  const hidden = decision.verdict === "flag" ? 1 : 0;
  const cid = newId();
  await c.env.DB.prepare(
    `INSERT INTO comments (id, event_id, post_id, author_id, body, parent_id, is_hidden, hidden_reason, is_bot)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0)`,
  )
    .bind(cid, id, viewer.id, text, body.parentId ?? null, hidden, hidden ? decision.reason : null)
    .run();

  return c.json({ ok: true, id: cid, hidden: !!hidden });
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

// GET /api/posts/admin/pending — admin queue
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

// PATCH /api/posts/:id/review — admin approves / rejects pending
posts.patch("/:id/review", requireAuth, requireTier("ADMIN"), async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();
  const body = await c.req.json<{ decision: "APPROVE" | "REJECT" | "HIDE"; note?: string }>();

  const post = await c.env.DB.prepare("SELECT id, status, author_id, title FROM posts WHERE id = ?")
    .bind(id)
    .first<{ id: string; status: string; author_id: string; title: string }>();
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

  await notify(c.env.DB, post.author_id, nextStatus === "PUBLISHED" ? "POST_APPROVED" : "POST_REJECTED", {
    postId: id,
    title: post.title,
    reason: body.note ?? "管理员复核完成",
    status: nextStatus,
  });

  await audit(c.env.DB, viewer.id, "POST_REVIEW", "Post", id, {
    decision: body.decision,
    nextStatus,
  });

  return c.json({ ok: true, status: nextStatus });
});

export default posts;
