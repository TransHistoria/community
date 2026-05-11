// Auth routes: magic-link send + verify → JWT response.

import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "@/types";
import { createMagicToken, verifyMagicToken } from "@/auth/magic";
import { signJwt } from "@/auth/jwt";
import { sendVerificationEmail } from "@/email/sender";
import { newId } from "@/lib/utils";
import { requireAuth } from "@/middleware/auth";
import type { UserRow } from "@/types";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

function shouldSoftFailEmail(c: { req: { url: string } }): boolean {
  const host = new URL(c.req.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

// POST /api/auth/send-link — send a magic link to the given email
auth.post("/send-link", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return c.json({ error: "请提供有效的邮箱地址" }, 400);
  }

  const token = await createMagicToken(c.env.DB, email);
  const url = `${c.env.FRONTEND_URL}/sign-in/verify?token=${token}`;

  try {
    await sendVerificationEmail(
      {
        sendEmail: c.env.SEND_EMAIL,
        from: c.env.EMAIL_FROM,
        appName: c.env.APP_NAME,
      },
      { to: email, url },
    );
  } catch (err) {
    console.error("Failed to send verification email:", err);
    if (shouldSoftFailEmail(c)) return c.json({ ok: true });
    return c.json({ error: "邮件发送失败，请联系管理员检查邮件服务配置" }, 502);
  }

  return c.json({ ok: true });
});

// POST /api/auth/create-admin — bootstrap the first admin account via secret
auth.post("/create-admin", async (c) => {
  const body = await c.req
    .json<{ email?: string; secret?: string }>()
    .catch(() => ({ email: "", secret: "" }));
  const email = (body.email ?? "").trim().toLowerCase();
  const secret = (body.secret ?? "").trim();
  if (!email || !email.includes("@") || !secret) {
    return c.json({ error: "参数缺失" }, 400);
  }

  const expectedSecret = (c.env.CREATE_ADMIN ?? "").trim();
  if (!expectedSecret) {
    return c.json({ error: "管理员初始化未启用" }, 403);
  }
  if (secret !== expectedSecret) {
    return c.json({ error: "初始化密钥无效" }, 403);
  }

  const existingAdmin = await c.env.DB.prepare(
    "SELECT id FROM users WHERE tier = 'ADMIN' LIMIT 1",
  ).first<{ id: string }>();
  if (existingAdmin) {
    return c.json({ error: "管理员已初始化" }, 409);
  }

  let user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();

  if (!user) {
    const baseHandle = email.split("@")[0]!.replace(/[^a-z0-9]/g, "_");
    const handle = await ensureUniqueHandle(c.env.DB, baseHandle, "");
    const userId = newId();
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, handle, display_name, tier, status, email_verified_at)
       VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE', datetime('now'))`,
    )
      .bind(userId, email, handle, handle)
      .run();
    user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(userId)
      .first<UserRow>();
  } else {
    await c.env.DB.prepare(
      "UPDATE users SET tier = 'ADMIN', status = 'ACTIVE', updated_at = datetime('now') WHERE id = ?",
    )
      .bind(user.id)
      .run();
  }

  const token = await createMagicToken(c.env.DB, email);
  const url = `${c.env.FRONTEND_URL}/sign-in/verify?token=${token}`;
  try {
    await sendVerificationEmail(
      {
        sendEmail: c.env.SEND_EMAIL,
        from: c.env.EMAIL_FROM,
        appName: c.env.APP_NAME,
      },
      { to: email, url },
    );
  } catch (err) {
    console.error("Failed to send admin bootstrap email:", err);
    if (shouldSoftFailEmail(c)) return c.json({ ok: true });
    return c.json({ error: "邮件发送失败，请联系管理员检查邮件服务配置" }, 502);
  }

  return c.json({ ok: true });
});

// POST /api/auth/verify — exchange magic token for JWT
auth.post("/verify", async (c) => {
  const body = await c.req.json<{ token?: string }>();
  const token = (body.token ?? "").trim();
  if (!token) return c.json({ error: "缺少 token" }, 400);

  const email = await verifyMagicToken(c.env.DB, token);
  if (!email) return c.json({ error: "链接无效或已过期" }, 400);

  // Find or create user
  let user = await c.env.DB.prepare(
    "SELECT * FROM users WHERE email = ?",
  )
    .bind(email)
    .first<UserRow>();

  if (!user) {
    const adminEmails = c.env.ADMIN_EMAILS
      ? c.env.ADMIN_EMAILS.split(",").map((s) => s.trim().toLowerCase())
      : [];
    const isAdmin = adminEmails.includes(email);

    const baseHandle = email.split("@")[0]!.replace(/[^a-z0-9]/g, "_");
    const handle = await ensureUniqueHandle(c.env.DB, baseHandle, "");

    let tier = "UNVERIFIED";
    let applicationId: string | null = null;

    if (isAdmin) {
      tier = "ADMIN";
    } else {
      // Check for approved application
      const app = await c.env.DB.prepare(
        "SELECT id FROM applications WHERE email = ? AND status = 'APPROVED' ORDER BY reviewed_at DESC LIMIT 1",
      )
        .bind(email)
        .first<{ id: string }>();
      if (app) {
        tier = "VERIFIED";
        applicationId = app.id;
      }
    }

    const userId = newId();
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, handle, display_name, tier, status, email_verified_at, application_id)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', datetime('now'), ?)`,
    )
      .bind(userId, email, handle, handle, tier, applicationId)
      .run();

    user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
      .bind(userId)
      .first<UserRow>();
  } else if (user.status === "SUSPENDED") {
    return c.json({ error: "账户已被暂停" }, 403);
  } else {
    // Update email_verified_at
    await c.env.DB.prepare(
      "UPDATE users SET email_verified_at = datetime('now') WHERE id = ?",
    )
      .bind(user.id)
      .run();

    // If UNVERIFIED, check for approved application
    if (user.tier === "UNVERIFIED" || user.tier === "GUEST") {
      const app = await c.env.DB.prepare(
        "SELECT id FROM applications WHERE email = ? AND status = 'APPROVED' ORDER BY reviewed_at DESC LIMIT 1",
      )
        .bind(email)
        .first<{ id: string }>();
      if (app) {
        await c.env.DB.prepare(
          "UPDATE users SET tier = 'VERIFIED', application_id = ? WHERE id = ?",
        )
          .bind(app.id, user.id)
          .run();
        user = { ...user, tier: "VERIFIED", application_id: app.id };
      }
    }
  }

  if (!user) return c.json({ error: "用户创建失败" }, 500);

  const jwt = await signJwt(
    { sub: user.id, handle: user.handle, tier: user.tier },
    c.env.JWT_SECRET,
  );

  return c.json({
    ok: true,
    token: jwt,
    user: {
      id: user.id,
      handle: user.handle,
      displayName: user.display_name,
      tier: user.tier,
      avatarUrl: user.avatar_url,
    },
  });
});

// POST /api/auth/verify-invite — verify invite code before requesting magic link
auth.post("/verify-invite", async (c) => {
  const body = await c.req.json<{ email?: string; code?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim().toUpperCase();
  if (!email || !code) return c.json({ error: "参数缺失" }, 400);

  const inv = await c.env.DB.prepare(
    "SELECT * FROM invite_codes WHERE code = ?",
  ).bind(code).first<{ code: string; max_uses: number; used_count: number; expires_at: string | null }>();

  if (!inv) return c.json({ error: "邀请码无效" }, 400);
  if (inv.used_count >= inv.max_uses) return c.json({ error: "邀请码已用完" }, 400);
  if (inv.expires_at && new Date(inv.expires_at) < new Date())
    return c.json({ error: "邀请码已过期" }, 400);

  // Store invite+email association temporarily by recording a notification
  const issuerRow = await c.env.DB.prepare(
    "SELECT id FROM users WHERE id = (SELECT issuer_id FROM invite_codes WHERE code = ?)",
  ).bind(code).first<{ id: string }>();

  if (issuerRow) {
    await c.env.DB.prepare(
      `INSERT INTO notifications (id, user_id, kind, payload)
       VALUES (?, ?, 'INVITE_PRECHECK', ?)`,
    )
      .bind(newId(), issuerRow.id, JSON.stringify({ email, code }))
      .run();
  }

  return c.json({ ok: true });
});

// GET /api/auth/me — return current user info
auth.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");
  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRow>();
  if (!user || user.status !== "ACTIVE") {
    return c.json({ error: "用户不存在" }, 401);
  }
  return c.json({
    id: user.id,
    handle: user.handle,
    displayName: user.display_name,
    tier: user.tier,
    avatarUrl: user.avatar_url,
    email: user.email,
    pronouns: user.pronouns,
    genderIdentity: user.gender_identity,
    bio: user.bio,
    createdAt: user.created_at,
  });
});

// POST /api/auth/sign-out — client-side only (JWT is stateless; just discard the token)
auth.post("/sign-out", (c) => c.json({ ok: true }));

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

export default auth;
