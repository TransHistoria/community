// Events API routes.

import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables, EventRow, RegistrationRow, CommentRow, UserRow } from "@/types";
import { requireAuth, optionalAuth, requireTier } from "@/middleware/auth";
import {
  canViewEvent,
  canEditEvent,
  canCreateEvent,
  canRegister,
  canComment,
  canViewEventDetails,
} from "@/lib/access";
import { newId, slugify, randomCode } from "@/lib/utils";
import { sendRegistrationStatusEmail } from "@/email/sender";

const events = new Hono<{ Bindings: Env; Variables: Variables }>();

// ---- Helpers ----

async function uniqueSlug(db: D1Database, base: string): Promise<string> {
  const stem = slugify(base) || "event";
  let candidate = stem;
  for (let i = 0; i < 5; i++) {
    const exists = await db
      .prepare("SELECT id FROM events WHERE slug = ?")
      .bind(candidate)
      .first();
    if (!exists) return candidate;
    candidate = `${stem}-${randomCode(4).toLowerCase()}`;
  }
  return `${stem}-${randomCode(6).toLowerCase()}`;
}

function viewerFrom(c: { get: (k: string) => string | undefined }) {
  const userId = c.get("userId");
  const userTier = c.get("userTier");
  if (!userId) return null;
  return { id: userId, tier: userTier ?? "GUEST" };
}

// ---- Event CRUD ----

// GET /api/events
events.get("/", optionalAuth, async (c) => {
  const viewer = viewerFrom(c);
  const { category, format, city, q, page = "1" } = c.req.query();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limit = 60;
  const offset = (pageNum - 1) * limit;

  // Build WHERE conditions based on viewer tier
  const tierConditions = buildVisibilityCondition(viewer);
  const conditions: string[] = [
    tierConditions,
    "e.status = 'PUBLISHED'",
    "e.end_at >= datetime('now')",
  ];
  const params: unknown[] = [];

  if (category) {
    conditions.push("e.category = ?");
    params.push(category);
  }
  if (format) {
    conditions.push("e.format = ?");
    params.push(format);
  }
  if (city) {
    conditions.push("e.city LIKE ?");
    params.push(`%${city}%`);
  }
  if (q) {
    conditions.push("(e.title LIKE ? OR e.description LIKE ?)");
    params.push(`%${q}%`, `%${q}%`);
  }

  const where = conditions.join(" AND ");
  const rows = await c.env.DB.prepare(
    `SELECT e.*, u.handle AS organizer_handle, u.display_name AS organizer_name,
       (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS reg_count
     FROM events e
     JOIN users u ON u.id = e.organizer_id
     WHERE ${where}
     ORDER BY e.start_at ASC
     LIMIT ? OFFSET ?`,
  )
    .bind(...params, limit, offset)
    .all<EventRow & { organizer_handle: string; organizer_name: string; reg_count: number }>();

  return c.json({ events: rows.results });
});

// GET /api/events/:slug
events.get("/:slug", optionalAuth, async (c) => {
  const { slug } = c.req.param();
  const viewer = viewerFrom(c);

  const event = await c.env.DB.prepare(
    `SELECT e.*, u.handle AS organizer_handle, u.display_name AS organizer_name, u.avatar_url AS organizer_avatar
     FROM events e JOIN users u ON u.id = e.organizer_id
     WHERE e.slug = ?`,
  )
    .bind(slug)
    .first<EventRow & { organizer_handle: string; organizer_name: string; organizer_avatar: string | null }>();

  if (!event) return c.json({ error: "活动不存在" }, 404);
  if (!canViewEvent(viewer, event)) return c.json({ error: "无权访问" }, 403);

  // Check viewer's registration
  let registration: RegistrationRow | null = null;
  if (viewer) {
    registration = await c.env.DB.prepare(
      "SELECT * FROM registrations WHERE event_id = ? AND user_id = ?",
    )
      .bind(event.id, viewer.id)
      .first<RegistrationRow>();
  }

  const canSeeDetails = canViewEventDetails(viewer, event, registration?.status ?? null);

  // Redact sensitive fields unless user can see details
  const result = {
    ...event,
    precise_addr: canSeeDetails ? event.precise_addr : null,
    online_url: canSeeDetails ? event.online_url : null,
    registration: registration
      ? {
          id: registration.id,
          status: registration.status,
          createdAt: registration.created_at,
        }
      : null,
    canEdit: canEditEvent(viewer, event),
    canRegister: canRegister(viewer, event).ok,
  };

  return c.json({ event: result });
});

// POST /api/events
events.post("/", requireAuth, requireTier("VERIFIED"), async (c) => {
  const viewer = viewerFrom(c)!;
  if (!canCreateEvent(viewer)) return c.json({ error: "无权创建" }, 403);

  const body = await c.req.json<{
    title: string;
    description: string;
    category: string;
    format: string;
    coverUrl?: string;
    startAt: string;
    endAt: string;
    timezone?: string;
    city?: string;
    preciseAddr?: string;
    onlineUrl?: string;
    capacity?: number;
    requireApproval?: boolean;
    registrationOpensAt?: string;
    registrationClosesAt?: string;
    customQuestions?: unknown[];
    visibility?: string;
  }>();

  if (!body.title || !body.description || !body.category || !body.format || !body.startAt || !body.endAt) {
    return c.json({ error: "缺少必填字段" }, 400);
  }

  const slug = await uniqueSlug(c.env.DB, body.title);
  const id = newId();

  await c.env.DB.prepare(
    `INSERT INTO events (id, organizer_id, title, slug, category, format, description,
       cover_url, start_at, end_at, timezone, city, precise_addr, online_url,
       capacity, require_approval, registration_opens_at, registration_closes_at,
       custom_questions, visibility, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED')`,
  )
    .bind(
      id,
      viewer.id,
      body.title,
      slug,
      body.category,
      body.format,
      body.description,
      body.coverUrl ?? null,
      body.startAt,
      body.endAt,
      body.timezone ?? "Asia/Shanghai",
      body.city ?? null,
      body.preciseAddr ?? null,
      body.onlineUrl ?? null,
      body.capacity ?? null,
      body.requireApproval ? 1 : 0,
      body.registrationOpensAt ?? null,
      body.registrationClosesAt ?? null,
      body.customQuestions ? JSON.stringify(body.customQuestions) : null,
      body.visibility ?? "VERIFIED",
    )
    .run();

  return c.json({ ok: true, slug });
});

// PATCH /api/events/:id
events.patch("/:id", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?")
    .bind(id)
    .first<EventRow>();
  if (!event) return c.json({ error: "活动不存在" }, 404);
  if (!canEditEvent(viewer, event)) return c.json({ error: "无权编辑" }, 403);

  const body = await c.req.json<Partial<{
    title: string; description: string; category: string; format: string;
    coverUrl: string | null; startAt: string; endAt: string; timezone: string;
    city: string | null; preciseAddr: string | null; onlineUrl: string | null;
    capacity: number | null; requireApproval: boolean;
    registrationOpensAt: string | null; registrationClosesAt: string | null;
    customQuestions: unknown[]; visibility: string;
  }>>();

  await c.env.DB.prepare(
    `UPDATE events SET
       title = COALESCE(?, title),
       description = COALESCE(?, description),
       category = COALESCE(?, category),
       format = COALESCE(?, format),
       cover_url = ?,
       start_at = COALESCE(?, start_at),
       end_at = COALESCE(?, end_at),
       timezone = COALESCE(?, timezone),
       city = ?,
       precise_addr = ?,
       online_url = ?,
       capacity = ?,
       require_approval = COALESCE(?, require_approval),
       registration_opens_at = ?,
       registration_closes_at = ?,
       custom_questions = ?,
       visibility = COALESCE(?, visibility),
       updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      body.title ?? null,
      body.description ?? null,
      body.category ?? null,
      body.format ?? null,
      body.coverUrl ?? null,
      body.startAt ?? null,
      body.endAt ?? null,
      body.timezone ?? null,
      body.city ?? null,
      body.preciseAddr ?? null,
      body.onlineUrl ?? null,
      body.capacity ?? null,
      body.requireApproval !== undefined ? (body.requireApproval ? 1 : 0) : null,
      body.registrationOpensAt ?? null,
      body.registrationClosesAt ?? null,
      body.customQuestions ? JSON.stringify(body.customQuestions) : null,
      body.visibility ?? null,
      id,
    )
    .run();

  return c.json({ ok: true });
});

// DELETE /api/events/:id (cancel)
events.delete("/:id", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?")
    .bind(id)
    .first<EventRow>();
  if (!event) return c.json({ error: "活动不存在" }, 404);
  if (!canEditEvent(viewer, event)) return c.json({ error: "无权操作" }, 403);

  await c.env.DB.prepare("UPDATE events SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();

  // Notify registrants
  const regs = await c.env.DB.prepare(
    "SELECT user_id FROM registrations WHERE event_id = ? AND status IN ('CONFIRMED','WAITLIST','PENDING')",
  )
    .bind(id)
    .all<{ user_id: string }>();

  const batch = regs.results.map((r) =>
    c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, kind, payload) VALUES (?, ?, 'EVENT_CANCELLED', ?)`,
    ).bind(newId(), r.user_id, JSON.stringify({ eventTitle: event.title, slug: event.slug })),
  );
  if (batch.length > 0) await c.env.DB.batch(batch);

  return c.json({ ok: true });
});

// ---- Registrations ----

// GET /api/events/:id/registrations (organizer only)
events.get("/:id/registrations", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?")
    .bind(id)
    .first<EventRow>();
  if (!event) return c.json({ error: "活动不存在" }, 404);
  if (!canEditEvent(viewer, event)) return c.json({ error: "无权操作" }, 403);

  const regs = await c.env.DB.prepare(
    `SELECT r.*, u.handle, u.display_name, u.avatar_url, u.tier
     FROM registrations r JOIN users u ON u.id = r.user_id
     WHERE r.event_id = ?
     ORDER BY r.created_at ASC`,
  )
    .bind(id)
    .all<RegistrationRow & { handle: string; display_name: string; avatar_url: string | null; tier: string }>();

  return c.json({ registrations: regs.results });
});

// POST /api/events/:id/registrations
events.post("/:id/registrations", requireAuth, requireTier("VERIFIED"), async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  const event = await c.env.DB.prepare("SELECT * FROM events WHERE id = ?")
    .bind(id)
    .first<EventRow>();
  if (!event) return c.json({ error: "活动不存在" }, 404);

  const allowed = canRegister(viewer, event);
  if (!allowed.ok) return c.json({ error: allowed.reason }, 403);

  const confirmedCount = await c.env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM registrations WHERE event_id = ? AND status IN ('CONFIRMED','CHECKED_IN')",
  )
    .bind(id)
    .first<{ cnt: number }>();

  const overCap = event.capacity != null && (confirmedCount?.cnt ?? 0) >= event.capacity;
  const status = event.require_approval ? "PENDING" : overCap ? "WAITLIST" : "CONFIRMED";

  const body = await c.req.json<{ answers?: Record<string, unknown> }>().catch(() => ({}));

  // Upsert registration
  const existing = await c.env.DB.prepare(
    "SELECT id FROM registrations WHERE event_id = ? AND user_id = ?",
  )
    .bind(id, viewer.id)
    .first<{ id: string }>();

  if (existing) {
    await c.env.DB.prepare(
      "UPDATE registrations SET status = ?, answers = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(status, JSON.stringify(body.answers ?? {}), existing.id)
      .run();
  } else {
    await c.env.DB.prepare(
      `INSERT INTO registrations (id, event_id, user_id, status, answers) VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(newId(), id, viewer.id, status, JSON.stringify(body.answers ?? {}))
      .run();
  }

  // Notifications
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, kind, payload) VALUES (?, ?, ?, ?)`,
    ).bind(
      newId(),
      event.organizer_id,
      "REG_NEW",
      JSON.stringify({ eventTitle: event.title, slug: event.slug, applicantHandle: viewer.id, status }),
    ),
    c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, kind, payload) VALUES (?, ?, ?, ?)`,
    ).bind(
      newId(),
      viewer.id,
      status === "CONFIRMED" ? "REG_CONFIRMED" : status === "WAITLIST" ? "REG_WAITLIST" : "REG_PENDING",
      JSON.stringify({ eventTitle: event.title, slug: event.slug }),
    ),
  ]);

  // Send email
  const userRow = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?")
    .bind(viewer.id)
    .first<{ email: string }>();
  if (userRow?.email) {
    sendRegistrationStatusEmail(
      { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
      {
        to: userRow.email,
        eventTitle: event.title,
        eventUrl: `${c.env.FRONTEND_URL}/events/${event.slug}`,
        status: status as "CONFIRMED" | "WAITLIST" | "DECLINED" | "PENDING",
      },
    ).catch(() => {});
  }

  return c.json({ ok: true, status });
});

// PATCH /api/registrations/:regId (organizer decides)
events.patch("/registrations/:regId", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { regId } = c.req.param();

  const reg = await c.env.DB.prepare(
    `SELECT r.*, e.organizer_id, e.title, e.slug
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.id = ?`,
  )
    .bind(regId)
    .first<RegistrationRow & { organizer_id: string; title: string; slug: string }>();

  if (!reg) return c.json({ error: "记录不存在" }, 404);
  if (!canEditEvent(viewer, { organizer_id: reg.organizer_id })) {
    return c.json({ error: "无权操作" }, 403);
  }

  const { decision } = await c.req.json<{ decision: string }>();
  if (!decision) return c.json({ error: "缺少 decision" }, 400);

  await c.env.DB.prepare(
    "UPDATE registrations SET status = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(decision, regId)
    .run();

  if (["CONFIRMED", "WAITLIST", "DECLINED"].includes(decision)) {
    const userRow = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?")
      .bind(reg.user_id)
      .first<{ email: string }>();
    if (userRow?.email) {
      sendRegistrationStatusEmail(
        { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
        {
          to: userRow.email,
          eventTitle: reg.title,
          eventUrl: `${c.env.FRONTEND_URL}/events/${reg.slug}`,
          status: decision as "CONFIRMED" | "WAITLIST" | "DECLINED" | "PENDING",
        },
      ).catch(() => {});
    }
  }

  return c.json({ ok: true });
});

// DELETE /api/registrations/:regId (cancel own registration)
events.delete("/registrations/:regId", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { regId } = c.req.param();

  const reg = await c.env.DB.prepare("SELECT * FROM registrations WHERE id = ?")
    .bind(regId)
    .first<RegistrationRow>();

  if (!reg) return c.json({ error: "未找到报名记录" }, 404);
  if (reg.user_id !== viewer.id) return c.json({ error: "无权操作" }, 403);

  await c.env.DB.prepare(
    "UPDATE registrations SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?",
  )
    .bind(regId)
    .run();

  return c.json({ ok: true });
});

// ---- Comments ----

// GET /api/events/:id/comments
events.get("/:id/comments", optionalAuth, async (c) => {
  const viewer = viewerFrom(c);
  const { id } = c.req.param();

  const rows = await c.env.DB.prepare(
    `SELECT c.*, u.handle AS author_handle, u.display_name AS author_name, u.avatar_url AS author_avatar
     FROM comments c JOIN users u ON u.id = c.author_id
     WHERE c.event_id = ? AND (c.is_hidden = 0 OR ? = 1)
     ORDER BY c.created_at ASC`,
  )
    .bind(id, viewer?.tier === "ADMIN" ? 1 : 0)
    .all<CommentRow & { author_handle: string; author_name: string; author_avatar: string | null }>();

  return c.json({ comments: rows.results });
});

// POST /api/events/:id/comments
events.post("/:id/comments", requireAuth, requireTier("VERIFIED"), async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  if (!canComment(viewer)) return c.json({ error: "无权评论" }, 403);

  const event = await c.env.DB.prepare("SELECT id FROM events WHERE id = ?")
    .bind(id)
    .first<{ id: string }>();
  if (!event) return c.json({ error: "活动不存在" }, 404);

  const body = await c.req.json<{ body: string; parentId?: string }>();
  if (!body.body?.trim()) return c.json({ error: "评论内容不能为空" }, 400);

  await c.env.DB.prepare(
    "INSERT INTO comments (id, event_id, author_id, body, parent_id) VALUES (?, ?, ?, ?, ?)",
  )
    .bind(newId(), id, viewer.id, body.body.trim(), body.parentId ?? null)
    .run();

  return c.json({ ok: true });
});

// PATCH /api/comments/:commentId/hide
events.patch("/comments/:commentId/hide", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { commentId } = c.req.param();

  const comment = await c.env.DB.prepare(
    `SELECT c.*, e.organizer_id FROM comments c JOIN events e ON e.id = c.event_id WHERE c.id = ?`,
  )
    .bind(commentId)
    .first<CommentRow & { organizer_id: string }>();

  if (!comment) return c.json({ error: "评论不存在" }, 404);

  const isOrganizer = comment.organizer_id === viewer.id;
  if (!isOrganizer && viewer.tier !== "ADMIN") {
    return c.json({ error: "无权操作" }, 403);
  }

  const reason = viewer.tier === "ADMIN" ? "管理员处理" : "组织者处理";
  await c.env.DB.prepare(
    "UPDATE comments SET is_hidden = 1, hidden_reason = ? WHERE id = ?",
  )
    .bind(reason, commentId)
    .run();

  return c.json({ ok: true });
});

// ---- Visibility helper ----

function buildVisibilityCondition(viewer: { id: string; tier: string } | null): string {
  if (!viewer) return "e.visibility = 'PUBLIC'";
  const rank: Record<string, number> = { GUEST: 0, UNVERIFIED: 1, VERIFIED: 2, TRUSTED: 3, ADMIN: 4 };
  const r = rank[viewer.tier] ?? 0;
  if (r >= 3) return "(e.visibility IN ('PUBLIC','VERIFIED','TRUSTED') OR e.organizer_id = '" + viewer.id + "')";
  if (r >= 2) return "(e.visibility IN ('PUBLIC','VERIFIED') OR e.organizer_id = '" + viewer.id + "')";
  return "e.visibility = 'PUBLIC'";
}

export default events;
