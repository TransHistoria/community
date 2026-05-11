// Applications API routes (join-request submission + admin review).

import { Hono } from "hono";
import type { D1Database } from "@cloudflare/workers-types";
import type { Env, Variables, ApplicationRow, UserRow } from "@/types";
import { requireAuth, requireTier } from "@/middleware/auth";
import { buildOtpAuthUrl, generateTotpSecret } from "@/auth/totp";
import { newId } from "@/lib/utils";
import {
  sendApplicationApprovedEmail,
  sendTotpSetupEmail,
  sendApplicationRejectedEmail,
} from "@/email/sender";

const applications = new Hono<{ Bindings: Env; Variables: Variables }>();

function viewerFrom(c: { get: (k: string) => string | undefined }) {
  const userId = c.get("userId");
  const userTier = c.get("userTier");
  if (!userId) return null;
  return { id: userId, tier: userTier ?? "GUEST" };
}

// POST /api/applications — submit a join application (public)
applications.post("/", async (c) => {
  const body = await c.req.json<{
    email?: string;
    answers?: Record<string, unknown>;
  }>();

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return c.json({ error: "请提供有效的邮箱地址" }, 400);
  }

  // Check for existing pending/approved application
  const existing = await c.env.DB.prepare(
    "SELECT id, status FROM applications WHERE email = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(email)
    .first<{ id: string; status: string }>();

  if (existing?.status === "PENDING") {
    return c.json({ error: "已有待审核的申请" }, 409);
  }
  if (existing?.status === "APPROVED") {
    return c.json({ error: "申请已通过，请直接登录" }, 409);
  }

  await c.env.DB.prepare(
    "INSERT INTO applications (id, email, answers) VALUES (?, ?, ?)",
  )
    .bind(newId(), email, JSON.stringify(body.answers ?? {}))
    .run();

  return c.json({ ok: true });
});

// GET /api/applications/mine — check own application status
applications.get("/mine", async (c) => {
  const email = c.req.query("email")?.trim().toLowerCase();
  if (!email) return c.json({ error: "缺少 email 参数" }, 400);

  const app = await c.env.DB.prepare(
    "SELECT id, status, created_at FROM applications WHERE email = ? ORDER BY created_at DESC LIMIT 1",
  )
    .bind(email)
    .first<{ id: string; status: string; created_at: string }>();

  return c.json({ application: app ?? null });
});

// ---- Admin routes ----

// GET /api/applications (admin)
applications.get("/", requireAuth, requireTier("ADMIN"), async (c) => {
  const status = c.req.query("status") ?? "PENDING";
  const rows = await c.env.DB.prepare(
    `SELECT a.*, u.handle AS reviewer_handle
     FROM applications a
     LEFT JOIN users u ON u.id = a.reviewer_id
     WHERE a.status = ?
     ORDER BY a.created_at DESC
     LIMIT 100`,
  )
    .bind(status)
    .all<ApplicationRow & { reviewer_handle: string | null }>();

  return c.json({ applications: rows.results });
});

// PATCH /api/applications/:id (admin approve/reject)
applications.patch("/:id", requireAuth, requireTier("ADMIN"), async (c) => {
  const viewer = viewerFrom(c)!;
  const { id } = c.req.param();

  const app = await c.env.DB.prepare("SELECT * FROM applications WHERE id = ?")
    .bind(id)
    .first<ApplicationRow>();
  if (!app) return c.json({ error: "申请不存在" }, 404);
  if (app.status !== "PENDING") return c.json({ error: "已处理过" }, 400);

  const body = await c.req.json<{ decision: "APPROVED" | "REJECTED"; note?: string }>();
  if (!body.decision) return c.json({ error: "缺少 decision" }, 400);

  await c.env.DB.prepare(
    `UPDATE applications SET status = ?, reviewer_id = ?, reviewer_note = ?,
       reviewed_at = datetime('now')
     WHERE id = ?`,
  )
    .bind(body.decision, viewer.id, body.note ?? null, id)
    .run();

  if (body.decision === "APPROVED") {
    let user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
      .bind(app.email)
      .first<UserRow>();

    if (!user) {
      const baseHandle = app.email.split("@")[0]!.replace(/[^a-z0-9]/g, "_");
      const handle = await ensureUniqueHandle(c.env.DB, baseHandle, "");
      const userId = newId();
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, handle, display_name, tier, status, email_verified_at, application_id)
         VALUES (?, ?, ?, ?, 'VERIFIED', 'ACTIVE', datetime('now'), ?)`,
      )
        .bind(userId, app.email, handle, handle, id)
        .run();
      user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(userId)
        .first<UserRow>();
    } else {
      await c.env.DB.prepare(
        `UPDATE users
         SET tier = CASE WHEN tier IN ('GUEST','UNVERIFIED') THEN 'VERIFIED' ELSE tier END,
             application_id = COALESCE(application_id, ?),
             updated_at = datetime('now')
         WHERE id = ?`,
      )
        .bind(id, user.id)
        .run();
      user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(user.id)
        .first<UserRow>();
    }

    if (!user) return c.json({ error: "用户创建失败" }, 500);

    const secret = generateTotpSecret();
    const otpauthUrl = buildOtpAuthUrl(c.env.APP_NAME, app.email, secret);
    if (user.totp_enabled && user.totp_secret) {
      await c.env.DB.prepare(
        "UPDATE users SET totp_pending_secret = ?, updated_at = datetime('now') WHERE id = ?",
      )
        .bind(secret, user.id)
        .run();
    } else {
      await c.env.DB.prepare(
        "UPDATE users SET totp_secret = ?, totp_pending_secret = NULL, totp_enabled = 1, email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
      )
        .bind(secret, user.id)
        .run();
    }

    c.executionCtx.waitUntil(
      sendApplicationApprovedEmail(
        { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
        { to: app.email, signInUrl: `${c.env.FRONTEND_URL}/sign-in`, userTier: user.tier },
      ).catch((err) => {
        console.error("Failed to send application approved email:", err);
      }),
    );

    c.executionCtx.waitUntil(
      sendTotpSetupEmail(
        { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
        { to: app.email, secret, otpauthUrl, userTier: user.tier },
      ).catch((err) => {
        console.error("Failed to send TOTP setup email on application approval:", err);
      }),
    );
  } else {
    c.executionCtx.waitUntil(
      sendApplicationRejectedEmail(
        { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
        { to: app.email, note: body.note },
      ).catch((err) => {
        console.error("Failed to send application rejected email:", err);
      }),
    );
  }

  // Audit log
  await c.env.DB.prepare(
    "INSERT INTO audit_logs (id, actor_id, action, target_type, target_id, meta) VALUES (?, ?, ?, 'Application', ?, ?)",
  )
    .bind(
      newId(),
      viewer.id,
      body.decision === "APPROVED" ? "APPLICATION_APPROVE" : "APPLICATION_REJECT",
      id,
      JSON.stringify({ note: body.note }),
    )
    .run();

  return c.json({ ok: true });
});

async function ensureUniqueHandle(
  db: D1Database,
  base: string,
  selfId: string,
): Promise<string> {
  let candidate = base || "user";
  let n = 0;
  for (let i = 0; i < 20; i++) {
    const row = await db
      .prepare("SELECT id FROM users WHERE handle = ?")
      .bind(candidate)
      .first<{ id: string }>();
    if (!row || row.id === selfId) return candidate;
    n += 1;
    candidate = `${base}_${n}`;
  }
  return `${base}_${Date.now()}`;
}

export default applications;
