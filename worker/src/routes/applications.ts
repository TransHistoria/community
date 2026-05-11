// Applications API routes (join-request submission + admin review).

import { Hono } from "hono";
import type { Env, Variables, ApplicationRow } from "@/types";
import { requireAuth, requireTier } from "@/middleware/auth";
import { newId } from "@/lib/utils";
import {
  sendApplicationApprovedEmail,
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
    // Promote any existing user with this email
    await c.env.DB.prepare(
      `UPDATE users SET tier = 'VERIFIED', application_id = ?
       WHERE email = ? AND tier IN ('GUEST','UNVERIFIED')`,
    )
      .bind(id, app.email)
      .run();

    sendApplicationApprovedEmail(
      { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
      { to: app.email },
    ).catch(() => {});
  } else {
    sendApplicationRejectedEmail(
      { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
      { to: app.email, note: body.note },
    ).catch(() => {});
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

export default applications;
