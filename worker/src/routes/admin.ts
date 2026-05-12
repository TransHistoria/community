// Admin API routes (users, reports, audit log).

import { Hono } from "hono";
import type { Env, Variables, UserRow, ReportRow, AuditLogRow } from "@/types";
import { requireAuth, requireTier } from "@/middleware/auth";
import { newId } from "@/lib/utils";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { sendTestEmail } from "@/email/sender";

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

function viewerFrom(c: { get: (k: string) => string | undefined }) {
  const userId = c.get("userId")!;
  const userTier = c.get("userTier") ?? "GUEST";
  return { id: userId, tier: userTier };
}

// Apply auth + admin tier to all routes
admin.use("/*", requireAuth, requireTier("ADMIN"));

// ---- Users ----

// GET /api/admin/users
admin.get("/users", async (c) => {
  const { tier, status, q, page = "1" } = c.req.query();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limit = 50;
  const offset = (pageNum - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (tier) { conditions.push("tier = ?"); params.push(tier); }
  if (status) { conditions.push("status = ?"); params.push(status); }
  if (q) {
    conditions.push("(handle LIKE ? OR display_name LIKE ? OR email LIKE ?)");
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await c.env.DB.prepare(
    `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, limit, offset)
    .all<UserRow>();

  return c.json({ users: rows.results });
});

// PATCH /api/admin/users/:id — set tier or suspend/reactivate
admin.patch("/users/:id", async (c) => {
  const viewer = viewerFrom(c);
  const { id } = c.req.param();

  const body = await c.req.json<{
    tier?: string;
    status?: "ACTIVE" | "SUSPENDED";
  }>();

  if (body.tier) {
    if (id === viewer.id && body.tier !== "ADMIN") {
      return c.json({ error: "不能降级自己" }, 400);
    }
    await c.env.DB.prepare(
      "UPDATE users SET tier = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(body.tier, id)
      .run();
    await auditLog(c.env.DB, viewer.id, "USER_TIER_SET", "User", id, { tier: body.tier });
  }

  if (body.status) {
    await c.env.DB.prepare(
      "UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?",
    )
      .bind(body.status, id)
      .run();
    await auditLog(
      c.env.DB,
      viewer.id,
      body.status === "SUSPENDED" ? "USER_SUSPEND" : "USER_REACTIVATE",
      "User",
      id,
    );
  }

  return c.json({ ok: true });
});

// ---- Reports ----

// GET /api/admin/reports
admin.get("/reports", async (c) => {
  const status = c.req.query("status") ?? "OPEN";
  const rows = await c.env.DB.prepare(
    `SELECT r.*, u.handle AS reporter_handle
     FROM reports r JOIN users u ON u.id = r.reporter_id
     WHERE r.status = ?
     ORDER BY r.created_at DESC LIMIT 100`,
  )
    .bind(status)
    .all<ReportRow & { reporter_handle: string }>();
  return c.json({ reports: rows.results });
});

// POST /api/admin/reports (submit a report — any logged-in user)
admin.post("/reports", async (c) => {
  // This is called from users route, but kept here for consistency
  return c.json({ error: "使用 /api/reports" }, 400);
});

// PATCH /api/admin/reports/:id
admin.patch("/reports/:id", async (c) => {
  const viewer = viewerFrom(c);
  const { id } = c.req.param();

  const report = await c.env.DB.prepare("SELECT * FROM reports WHERE id = ?")
    .bind(id)
    .first<ReportRow>();
  if (!report) return c.json({ error: "举报不存在" }, 404);

  const body = await c.req.json<{
    decision: "RESOLVED" | "DISMISSED";
    note?: string;
    hideTarget?: boolean;
  }>();

  if (body.hideTarget && body.decision === "RESOLVED") {
    if (report.target_type === "COMMENT") {
      await c.env.DB.prepare(
        "UPDATE comments SET is_hidden = 1, hidden_reason = '管理员处理（举报）' WHERE id = ?",
      )
        .bind(report.target_id)
        .run();
    } else if (report.target_type === "EVENT") {
      await c.env.DB.prepare(
        "UPDATE events SET status = 'CANCELLED', updated_at = datetime('now') WHERE id = ?",
      )
        .bind(report.target_id)
        .run();
    } else if (report.target_type === "USER") {
      await c.env.DB.prepare(
        "UPDATE users SET status = 'SUSPENDED', updated_at = datetime('now') WHERE id = ?",
      )
        .bind(report.target_id)
        .run();
    }
  }

  await c.env.DB.prepare(
    `UPDATE reports SET status = ?, resolved_note = ?, resolved_by_id = ?,
       resolved_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(body.decision, body.note ?? null, viewer.id, id)
    .run();

  await auditLog(c.env.DB, viewer.id, "REPORT_RESOLVE", "Report", id, {
    decision: body.decision,
    hideTarget: body.hideTarget,
  });

  return c.json({ ok: true });
});

// ---- System ----

// POST /api/admin/test-email — send a test email to the calling admin
admin.post("/test-email", async (c) => {
  const userId = c.get("userId")!;
  const user = await c.env.DB.prepare("SELECT email FROM users WHERE id = ?")
    .bind(userId)
    .first<{ email: string }>();
  if (!user) return c.json({ error: "用户不存在" }, 404);

  const body = await c.req.json<{ to?: string }>().catch(() => ({ to: undefined }));
  const to = (body.to ?? "").trim() || user.email;
  if (!to.includes("@")) return c.json({ error: "无效的收件地址" }, 400);

  try {
    await sendTestEmail(
      { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
      { to },
    );
  } catch (err) {
    console.error("Failed to send test email:", err);
    return c.json({ error: "邮件发送失败，请检查邮件服务配置" }, 502);
  }

  await auditLog(c.env.DB, userId, "ADMIN_TEST_EMAIL", "System", userId, { to });
  return c.json({ ok: true });
});

// POST /api/admin/test-turnstile — verify current Turnstile configuration
admin.post("/test-turnstile", async (c) => {
  const userId = c.get("userId")!;
  const enforced = Boolean((c.env.TURNSTILE_SECRET_KEY ?? "").trim());
  if (!enforced) {
    return c.json({ ok: true, enforced: false, message: "未配置 TURNSTILE_SECRET_KEY" });
  }

  const body = await c.req
    .json<{ turnstileToken?: string }>()
    .catch((): { turnstileToken?: string } => ({}));
  const check = await verifyTurnstileToken(
    c.env,
    body.turnstileToken,
    c.req.header("CF-Connecting-IP"),
  );
  if (!check.ok) return c.json({ error: check.error }, 400);

  await auditLog(c.env.DB, userId, "ADMIN_TEST_TURNSTILE", "System", userId, { ok: true });
  return c.json({ ok: true, enforced: true });
});

// ---- Audit Log ----

// GET /api/admin/audit
admin.get("/audit", async (c) => {
  const { actorId, targetType, page = "1" } = c.req.query();
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limit = 50;
  const offset = (pageNum - 1) * limit;

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (actorId) { conditions.push("a.actor_id = ?"); params.push(actorId); }
  if (targetType) { conditions.push("a.target_type = ?"); params.push(targetType); }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.handle AS actor_handle
     FROM audit_logs a JOIN users u ON u.id = a.actor_id
     ${where}
     ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, limit, offset)
    .all<AuditLogRow & { actor_handle: string }>();

  return c.json({ logs: rows.results });
});

// ---- Reports (submit, any logged-in user) ----
// Mounted separately in index.ts

async function auditLog(
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

export default admin;
