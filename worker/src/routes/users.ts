// Users API routes (profile, contacts, invites, blocks).

import { Hono } from "hono";
import type { Env, Variables, UserRow, ContactMethodRow, ContactRequestRow, InviteCodeRow, BlockRow } from "@/types";
import { requireAuth, optionalAuth } from "@/middleware/auth";
import { canViewProfile, canIssueInvites, inviteQuotaPerQuarter } from "@/lib/access";
import { newId, randomCode, quarterStart } from "@/lib/utils";
import { sendContactRequestEmail } from "@/email/sender";

const users = new Hono<{ Bindings: Env; Variables: Variables }>();

function viewerFrom(c: { get: (k: string) => string | undefined }) {
  const userId = c.get("userId");
  const userTier = c.get("userTier");
  if (!userId) return null;
  return { id: userId, tier: userTier ?? "GUEST" };
}

// GET /api/users/me — alias for auth/me (already in auth route)

// PATCH /api/users/me — update own profile
users.patch("/me", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const body = await c.req.json<{
    displayName?: string;
    pronouns?: string | null;
    genderIdentity?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
  }>();

  await c.env.DB.prepare(
    `UPDATE users SET
       display_name = COALESCE(?, display_name),
       pronouns = ?,
       gender_identity = ?,
       bio = ?,
       avatar_url = ?,
       updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(
      body.displayName ?? null,
      body.pronouns ?? null,
      body.genderIdentity ?? null,
      body.bio ?? null,
      body.avatarUrl ?? null,
      viewer.id,
    )
    .run();

  return c.json({ ok: true });
});

// GET /api/users/:handle — public profile
users.get("/:handle", optionalAuth, async (c) => {
  const viewer = viewerFrom(c);
  const { handle } = c.req.param();

  const user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE handle = ?",
  )
    .bind(handle)
    .first<UserRow>();

  if (!user) return c.json({ error: "用户不存在" }, 404);
  if (!canViewProfile(viewer, user)) return c.json({ error: "无权查看" }, 403);

  // Contacts visible to viewer
  const contacts = await c.env.DB.prepare(
    "SELECT * FROM contact_methods WHERE user_id = ? ORDER BY sort_order ASC",
  )
    .bind(user.id)
    .all<ContactMethodRow>();

  // Check approved contact requests from viewer
  let approvedContactIds: Set<string> = new Set();
  if (viewer && viewer.id !== user.id) {
    const approved = await c.env.DB.prepare(
      "SELECT contact_id FROM contact_requests WHERE requester_id = ? AND target_id = ? AND status = 'APPROVED'",
    )
      .bind(viewer.id, user.id)
      .all<{ contact_id: string | null }>();
    approvedContactIds = new Set(approved.results.map((r) => r.contact_id).filter(Boolean) as string[]);
  }

  const filteredContacts = contacts.results.filter((contact) => {
    if (viewer?.id === user.id || viewer?.tier === "ADMIN") return true;
    if (contact.visibility === "HIDDEN_REQUEST") return approvedContactIds.has(contact.id);
    const tierRank: Record<string, number> = { GUEST: 0, UNVERIFIED: 1, VERIFIED: 2, TRUSTED: 3, ADMIN: 4 };
    const required: Record<string, number> = { PUBLIC: 0, VERIFIED: 2, TRUSTED: 3 };
    return (tierRank[viewer?.tier ?? "GUEST"] ?? 0) >= (required[contact.visibility] ?? 4);
  });

  // Check if viewer is blocked
  if (viewer && viewer.id !== user.id) {
    const blocked = await c.env.DB.prepare(
      "SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?",
    )
      .bind(user.id, viewer.id)
      .first();
    if (blocked) return c.json({ error: "无权查看" }, 403);
  }

  return c.json({
    id: user.id,
    handle: user.handle,
    displayName: user.display_name,
    pronouns: user.pronouns,
    genderIdentity: user.gender_identity,
    bio: user.bio,
    avatarUrl: user.avatar_url,
    tier: user.tier,
    createdAt: user.created_at,
    contacts: filteredContacts,
    isSelf: viewer?.id === user.id,
  });
});

// ---- Contacts ----

// GET /api/users/me/contacts
users.get("/me/contacts", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const contacts = await c.env.DB.prepare(
    "SELECT * FROM contact_methods WHERE user_id = ? ORDER BY sort_order ASC",
  )
    .bind(viewer.id)
    .all<ContactMethodRow>();
  return c.json({ contacts: contacts.results });
});

// POST /api/users/me/contacts
users.post("/me/contacts", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const body = await c.req.json<{
    kind: string;
    value: string;
    label?: string;
    visibility?: string;
  }>();

  if (!body.kind || !body.value) return c.json({ error: "缺少必填字段" }, 400);

  const maxRow = await c.env.DB.prepare(
    "SELECT MAX(sort_order) AS max_order FROM contact_methods WHERE user_id = ?",
  )
    .bind(viewer.id)
    .first<{ max_order: number | null }>();

  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO contact_methods (id, user_id, kind, value, label, visibility, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      viewer.id,
      body.kind,
      body.value.trim(),
      body.label?.trim() ?? null,
      body.visibility ?? "VERIFIED",
      (maxRow?.max_order ?? 0) + 1,
    )
    .run();

  return c.json({ ok: true, id });
});

// PATCH /api/users/me/contacts/:contactId
users.patch("/me/contacts/:contactId", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { contactId } = c.req.param();

  const existing = await c.env.DB.prepare(
    "SELECT * FROM contact_methods WHERE id = ?",
  )
    .bind(contactId)
    .first<ContactMethodRow>();

  if (!existing || existing.user_id !== viewer.id) {
    return c.json({ error: "无权编辑" }, 403);
  }

  const body = await c.req.json<{
    kind?: string; value?: string; label?: string | null; visibility?: string;
  }>();

  await c.env.DB.prepare(
    `UPDATE contact_methods SET
       kind = COALESCE(?, kind), value = COALESCE(?, value),
       label = ?, visibility = COALESCE(?, visibility),
       updated_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(body.kind ?? null, body.value?.trim() ?? null, body.label ?? null, body.visibility ?? null, contactId)
    .run();

  return c.json({ ok: true });
});

// DELETE /api/users/me/contacts/:contactId
users.delete("/me/contacts/:contactId", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { contactId } = c.req.param();

  const existing = await c.env.DB.prepare(
    "SELECT user_id FROM contact_methods WHERE id = ?",
  )
    .bind(contactId)
    .first<{ user_id: string }>();

  if (!existing || existing.user_id !== viewer.id) {
    return c.json({ error: "无权删除" }, 403);
  }

  await c.env.DB.prepare("DELETE FROM contact_methods WHERE id = ?")
    .bind(contactId)
    .run();

  return c.json({ ok: true });
});

// ---- Contact Requests ----

// GET /api/users/me/contact-requests
users.get("/me/contact-requests", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const requests = await c.env.DB.prepare(
    `SELECT cr.*, u.handle AS requester_handle, u.display_name AS requester_name, u.avatar_url AS requester_avatar
     FROM contact_requests cr JOIN users u ON u.id = cr.requester_id
     WHERE cr.target_id = ? AND cr.status = 'PENDING'
     ORDER BY cr.created_at DESC`,
  )
    .bind(viewer.id)
    .all<ContactRequestRow & { requester_handle: string; requester_name: string; requester_avatar: string | null }>();
  return c.json({ requests: requests.results });
});

// POST /api/users/:handle/contact-requests
users.post("/:handle/contact-requests", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { handle } = c.req.param();

  const target = await c.env.DB.prepare("SELECT id, email FROM users WHERE handle = ?")
    .bind(handle)
    .first<{ id: string; email: string }>();
  if (!target) return c.json({ error: "用户不存在" }, 404);
  if (target.id === viewer.id) return c.json({ error: "不能向自己发送请求" }, 400);

  const body = await c.req.json<{ contactId?: string; reason: string }>();
  if (!body.reason?.trim()) return c.json({ error: "请填写申请理由" }, 400);

  // SQLite's UNIQUE constraint treats NULL != NULL, so a plain INSERT would not
  // catch duplicate requests when contact_id is NULL.  Do an explicit pre-check.
  const existingReq = await c.env.DB.prepare(
    `SELECT id FROM contact_requests
     WHERE requester_id = ? AND target_id = ? AND status NOT IN ('DECLINED')
       AND contact_id IS ?`,
  )
    .bind(viewer.id, target.id, body.contactId ?? null)
    .first<{ id: string }>();
  if (existingReq) return c.json({ error: "请求已存在" }, 409);

  const id = newId();
  try {
    await c.env.DB.prepare(
      `INSERT INTO contact_requests (id, requester_id, target_id, contact_id, reason)
       VALUES (?, ?, ?, ?, ?)`,
    )
      .bind(id, viewer.id, target.id, body.contactId ?? null, body.reason.trim())
      .run();
  } catch {
    return c.json({ error: "请求已存在" }, 409);
  }

  // Email notification
  const requesterRow = await c.env.DB.prepare("SELECT display_name FROM users WHERE id = ?")
    .bind(viewer.id)
    .first<{ display_name: string }>();

  sendContactRequestEmail(
    { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
    {
      to: target.email,
      requesterName: requesterRow?.display_name ?? viewer.id,
      reason: body.reason.trim(),
      url: `${c.env.FRONTEND_URL}/me/contact-requests`,
    },
  ).catch(() => {});

  return c.json({ ok: true, id });
});

// PATCH /api/users/me/contact-requests/:reqId
users.patch("/me/contact-requests/:reqId", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { reqId } = c.req.param();

  const req = await c.env.DB.prepare("SELECT * FROM contact_requests WHERE id = ?")
    .bind(reqId)
    .first<ContactRequestRow>();

  if (!req || req.target_id !== viewer.id) return c.json({ error: "无权操作" }, 403);
  if (req.status !== "PENDING") return c.json({ error: "已经处理过" }, 400);

  const { decision } = await c.req.json<{ decision: "APPROVED" | "DECLINED" }>();
  if (!decision) return c.json({ error: "缺少 decision" }, 400);

  await c.env.DB.prepare(
    "UPDATE contact_requests SET status = ?, decided_at = datetime('now') WHERE id = ?",
  )
    .bind(decision, reqId)
    .run();

  await c.env.DB.prepare(
    `INSERT INTO notifications (id, user_id, kind, payload) VALUES (?, ?, ?, ?)`,
  )
    .bind(
      newId(),
      req.requester_id,
      decision === "APPROVED" ? "CONTACT_REQ_APPROVED" : "CONTACT_REQ_DECLINED",
      JSON.stringify({ targetHandle: c.get("userHandle") }),
    )
    .run();

  return c.json({ ok: true });
});

// ---- Invite Codes ----

// GET /api/users/me/invites
users.get("/me/invites", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const invites = await c.env.DB.prepare(
    "SELECT * FROM invite_codes WHERE issuer_id = ? ORDER BY created_at DESC",
  )
    .bind(viewer.id)
    .all<InviteCodeRow>();
  return c.json({ invites: invites.results });
});

// POST /api/users/me/invites
users.post("/me/invites", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;

  if (!canIssueInvites(viewer)) {
    return c.json({ error: "当前等级不能签发邀请码" }, 403);
  }

  const qStart = quarterStart().toISOString();
  const used = await c.env.DB.prepare(
    "SELECT COUNT(*) AS cnt FROM invite_codes WHERE issuer_id = ? AND created_at >= ?",
  )
    .bind(viewer.id, qStart)
    .first<{ cnt: number }>();

  const quota = inviteQuotaPerQuarter(viewer.tier);
  if ((used?.cnt ?? 0) >= quota) {
    return c.json({ error: "本季度配额已用完" }, 400);
  }

  const body: { note?: string; expiresInDays?: number } = await c.req
    .json<{ note?: string; expiresInDays?: number }>()
    .catch(() => ({}));

  let code = "";
  for (let i = 0; i < 8; i++) {
    code = randomCode(8);
    const exists = await c.env.DB.prepare("SELECT code FROM invite_codes WHERE code = ?")
      .bind(code)
      .first();
    if (!exists) break;
  }

  const expiresAt =
    body.expiresInDays && body.expiresInDays > 0
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

  await c.env.DB.prepare(
    `INSERT INTO invite_codes (code, issuer_id, max_uses, note, expires_at) VALUES (?, ?, 1, ?, ?)`,
  )
    .bind(code, viewer.id, body.note?.trim() ?? null, expiresAt)
    .run();

  return c.json({ ok: true, code });
});

// ---- Blocks ----

// GET /api/users/me/blocks
users.get("/me/blocks", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const blocks = await c.env.DB.prepare(
    `SELECT b.*, u.handle, u.display_name, u.avatar_url
     FROM blocks b JOIN users u ON u.id = b.blocked_id
     WHERE b.blocker_id = ?
     ORDER BY b.created_at DESC`,
  )
    .bind(viewer.id)
    .all<BlockRow & { handle: string; display_name: string; avatar_url: string | null }>();
  return c.json({ blocks: blocks.results });
});

// POST /api/users/:handle/block
users.post("/:handle/block", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { handle } = c.req.param();

  const target = await c.env.DB.prepare("SELECT id FROM users WHERE handle = ?")
    .bind(handle)
    .first<{ id: string }>();
  if (!target) return c.json({ error: "用户不存在" }, 404);
  if (target.id === viewer.id) return c.json({ error: "不能屏蔽自己" }, 400);

  try {
    await c.env.DB.prepare(
      "INSERT INTO blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)",
    )
      .bind(newId(), viewer.id, target.id)
      .run();
  } catch {
    // Already blocked — ignore
  }

  return c.json({ ok: true });
});

// DELETE /api/users/:handle/block
users.delete("/:handle/block", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const { handle } = c.req.param();

  const target = await c.env.DB.prepare("SELECT id FROM users WHERE handle = ?")
    .bind(handle)
    .first<{ id: string }>();
  if (!target) return c.json({ error: "用户不存在" }, 404);

  await c.env.DB.prepare(
    "DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?",
  )
    .bind(viewer.id, target.id)
    .run();

  return c.json({ ok: true });
});

// ---- My registrations ----

// GET /api/users/me/registrations
users.get("/me/registrations", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;
  const regs = await c.env.DB.prepare(
    `SELECT r.*, e.title, e.slug, e.start_at, e.end_at, e.format, e.city
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.user_id = ? AND r.status NOT IN ('CANCELLED')
     ORDER BY e.start_at DESC`,
  )
    .bind(viewer.id)
    .all();
  return c.json({ registrations: regs.results });
});

// GET /api/users/me/export — download own data
users.get("/me/export", requireAuth, async (c) => {
  const viewer = viewerFrom(c)!;

  const user = await c.env.DB.prepare(
    "SELECT id, handle, display_name, pronouns, gender_identity, bio, avatar_url, email, tier, status, created_at, updated_at FROM users WHERE id = ?",
  )
    .bind(viewer.id)
    .first();

  const contacts = await c.env.DB.prepare(
    "SELECT kind, value, label, visibility FROM contact_methods WHERE user_id = ? ORDER BY sort_order ASC",
  )
    .bind(viewer.id)
    .all();

  const registrations = await c.env.DB.prepare(
    `SELECT r.status, r.created_at, e.title, e.slug, e.start_at, e.end_at
     FROM registrations r JOIN events e ON e.id = r.event_id
     WHERE r.user_id = ?
     ORDER BY e.start_at DESC`,
  )
    .bind(viewer.id)
    .all();

  const notifications = await c.env.DB.prepare(
    "SELECT kind, payload, read_at, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC",
  )
    .bind(viewer.id)
    .all();

  return c.json({
    exported_at: new Date().toISOString(),
    profile: user,
    contacts: contacts.results,
    registrations: registrations.results,
    notifications: notifications.results,
  });
});

// ---- Subscriptions (follow author / follow tag) ----

// GET /api/users/me/subscriptions
users.get("/me/subscriptions", requireAuth, async (c) => {
  const userId = c.get("userId")!;
  const rows = await c.env.DB
    .prepare("SELECT kind, ref, created_at FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC")
    .bind(userId)
    .all<{ kind: string; ref: string; created_at: string }>();
  return c.json({ subscriptions: rows.results });
});

// POST /api/users/me/subscriptions  body: { kind: 'AUTHOR'|'TAG', ref: string }
users.post("/me/subscriptions", requireAuth, async (c) => {
  const userId = c.get("userId")!;
  const body = await c.req.json<{ kind?: string; ref?: string }>();
  const kind = body.kind?.toUpperCase();
  const ref = (body.ref ?? "").trim().slice(0, 100);
  if ((kind !== "AUTHOR" && kind !== "TAG") || !ref) {
    return c.json({ error: "kind 必须是 AUTHOR 或 TAG, ref 不能为空" }, 400);
  }
  if (kind === "AUTHOR" && ref === userId) {
    return c.json({ error: "不能关注自己" }, 400);
  }
  const id = newId();
  try {
    await c.env.DB
      .prepare("INSERT INTO subscriptions (id, user_id, kind, ref) VALUES (?, ?, ?, ?)")
      .bind(id, userId, kind, ref)
      .run();
  } catch {
    return c.json({ ok: true, alreadyExists: true });
  }
  return c.json({ ok: true });
});

// DELETE /api/users/me/subscriptions  body: { kind, ref }
users.delete("/me/subscriptions", requireAuth, async (c) => {
  const userId = c.get("userId")!;
  const body = await c.req.json<{ kind?: string; ref?: string }>();
  const kind = body.kind?.toUpperCase();
  const ref = (body.ref ?? "").trim();
  if ((kind !== "AUTHOR" && kind !== "TAG") || !ref) {
    return c.json({ error: "kind/ref 缺失" }, 400);
  }
  await c.env.DB
    .prepare("DELETE FROM subscriptions WHERE user_id = ? AND kind = ? AND ref = ?")
    .bind(userId, kind, ref)
    .run();
  return c.json({ ok: true });
});

export default users;
