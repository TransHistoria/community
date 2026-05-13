// Auth routes: magic-link send + verify → JWT response.

import { Hono } from "hono";
import { z } from "zod";
import type { Env, Variables } from "@/types";
import { createMagicToken, verifyMagicToken } from "@/auth/magic";
import { buildOtpAuthUrl, generateTotpSecret, verifyTotpCode } from "@/auth/totp";
import { hashPassword, verifyPassword, generateRandomPassword } from "@/auth/password";
import { signJwt } from "@/auth/jwt";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
} from "@/email/sender";
import { newId } from "@/lib/utils";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { requireAuth } from "@/middleware/auth";
import type { UserRow } from "@/types";

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

function shouldSoftFailEmail(c: { req: { url: string } }): boolean {
  const host = new URL(c.req.url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/** Issue a JWT and return the standard login response shape. */
async function issueJwt(env: Env, user: UserRow) {
  const jwt = await signJwt(
    { sub: user.id, handle: user.handle, tier: user.tier },
    env.JWT_SECRET,
  );
  return {
    ok: true,
    token: jwt,
    user: {
      id: user.id,
      handle: user.handle,
      displayName: user.display_name,
      tier: user.tier,
      avatarUrl: user.avatar_url,
    },
  };
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

// POST /api/auth/register-totp — provision TOTP + initial password and send welcome email
auth.post("/register-totp", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return c.json({ error: "请提供有效的邮箱地址" }, 400);
  }

  let user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
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
  }

  if (!user || user.status === "SUSPENDED") return c.json({ error: "账户不可用" }, 403);

  // Provision TOTP secret
  const secret = generateTotpSecret();
  const otpauthUrl = buildOtpAuthUrl(c.env.APP_NAME, email, secret);
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

  // Provision initial password as pending (takes over on first successful login with it)
  const initialPassword = generateRandomPassword();
  const pendingHash = await hashPassword(initialPassword);
  await c.env.DB.prepare(
    "UPDATE users SET password_pending_hash = ?, updated_at = datetime('now') WHERE id = ?",
  )
    .bind(pendingHash, user.id)
    .run();

  try {
    await sendWelcomeEmail(
      { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
      {
        to: email,
        signInUrl: `${c.env.FRONTEND_URL}/sign-in`,
        secret,
        otpauthUrl,
        initialPassword,
        userTier: user.tier,
      },
    );
  } catch (err) {
    console.error("Failed to send welcome email:", err);
    if (shouldSoftFailEmail(c)) return c.json({ ok: true });
    return c.json({ error: "邮件发送失败，请联系管理员检查邮件服务配置" }, 502);
  }

  return c.json({ ok: true });
});

// POST /api/auth/login-totp — verify TOTP code and issue JWT
auth.post("/login-totp", async (c) => {
  const body = await c.req.json<{ email?: string; code?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();
  if (!email || !code) return c.json({ error: "参数缺失" }, 400);

  let user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!user || user.status !== "ACTIVE") return c.json({ error: "用户不存在" }, 401);

  const authMode = user.auth_mode ?? "EITHER";
  if (authMode === "PASSWORD_ONLY") {
    return c.json({ error: "该账号仅允许密码登录" }, 403);
  }
  if (!user.totp_enabled || !user.totp_secret) {
    return c.json({ error: "该邮箱尚未初始化 TOTP，请先完成注册" }, 400);
  }

  let verified = await verifyTotpCode(user.totp_secret, code);
  if (!verified && user.totp_pending_secret) {
    const pendingOk = await verifyTotpCode(user.totp_pending_secret, code);
    if (pendingOk) {
      await c.env.DB.prepare(
        "UPDATE users SET totp_secret = ?, totp_pending_secret = NULL, totp_enabled = 1, updated_at = datetime('now') WHERE id = ?",
      )
        .bind(user.totp_pending_secret, user.id)
        .run();
      user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
        .bind(user.id)
        .first<UserRow>();
      verified = true;
    }
  }
  if (!verified || !user) return c.json({ error: "验证码无效" }, 401);

  await c.env.DB.prepare(
    "UPDATE users SET email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  )
    .bind(user.id)
    .run();

  return c.json(await issueJwt(c.env, user));
});

// POST /api/auth/login-password — verify password and issue JWT
auth.post("/login-password", async (c) => {
  const body = await c.req.json<{ email?: string; password?: string; code?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const totpCode = (body.code ?? "").trim();
  if (!email || !password) return c.json({ error: "参数缺失" }, 400);

  let user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
    .bind(email)
    .first<UserRow>();
  if (!user || user.status !== "ACTIVE") return c.json({ error: "用户不存在或密码错误" }, 401);

  const authMode = user.auth_mode ?? "EITHER";
  if (authMode === "TOTP_ONLY") {
    return c.json({ error: "该账号仅允许 TOTP 登录" }, 403);
  }

  // Try active password first, then pending password (promotes on match)
  let passwordOk = false;
  let promotePending = false;

  if (user.password_hash && await verifyPassword(password, user.password_hash)) {
    passwordOk = true;
  } else if (user.password_pending_hash && await verifyPassword(password, user.password_pending_hash)) {
    passwordOk = true;
    promotePending = true;
  }

  if (!passwordOk) return c.json({ error: "用户不存在或密码错误" }, 401);

  // For BOTH_REQUIRED, also verify TOTP
  if (authMode === "BOTH_REQUIRED") {
    if (!totpCode) return c.json({ error: "该账号要求同时提供密码和 TOTP 验证码" }, 400);
    if (!user.totp_enabled || !user.totp_secret) {
      return c.json({ error: "TOTP 尚未配置，请联系管理员" }, 400);
    }
    let totpOk = await verifyTotpCode(user.totp_secret, totpCode);
    if (!totpOk && user.totp_pending_secret) {
      const pendingOk = await verifyTotpCode(user.totp_pending_secret, totpCode);
      if (pendingOk) {
        await c.env.DB.prepare(
          "UPDATE users SET totp_secret = ?, totp_pending_secret = NULL, updated_at = datetime('now') WHERE id = ?",
        ).bind(user.totp_pending_secret, user.id).run();
        user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first<UserRow>();
        totpOk = true;
      }
    }
    if (!totpOk) return c.json({ error: "TOTP 验证码无效" }, 401);
  }

  // Promote pending password to active
  if (promotePending && user) {
    await c.env.DB.prepare(
      "UPDATE users SET password_hash = password_pending_hash, password_pending_hash = NULL, updated_at = datetime('now') WHERE id = ?",
    ).bind(user.id).run();
    user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(user.id).first<UserRow>();
  }

  if (!user) return c.json({ error: "登录失败" }, 500);

  await c.env.DB.prepare(
    "UPDATE users SET email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  ).bind(user.id).run();

  return c.json(await issueJwt(c.env, user));
});

// POST /api/auth/reset-password — send a new generated password as pending
auth.post("/reset-password", async (c) => {
  const body = await c.req.json<{ email?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return c.json({ error: "请提供有效的邮箱地址" }, 400);

  const user = await c.env.DB.prepare("SELECT id, status FROM users WHERE email = ?")
    .bind(email)
    .first<{ id: string; status: string }>();

  // Always return ok to avoid email enumeration; silently skip unknown emails
  if (!user || user.status !== "ACTIVE") return c.json({ ok: true });

  const newPassword = generateRandomPassword();
  const pendingHash = await hashPassword(newPassword);
  await c.env.DB.prepare(
    "UPDATE users SET password_pending_hash = ?, updated_at = datetime('now') WHERE id = ?",
  ).bind(pendingHash, user.id).run();

  try {
    await sendPasswordResetEmail(
      { sendEmail: c.env.SEND_EMAIL, from: c.env.EMAIL_FROM, appName: c.env.APP_NAME },
      { to: email, signInUrl: `${c.env.FRONTEND_URL}/sign-in`, newPassword },
    );
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    if (shouldSoftFailEmail(c)) return c.json({ ok: true });
    return c.json({ error: "邮件发送失败，请联系管理员" }, 502);
  }

  return c.json({ ok: true });
});

// PATCH /api/auth/security — change password (pending) or update auth_mode
// Requires TOTP code OR current password to confirm identity.
auth.patch("/security", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    newPassword?: string;
    authMode?: string;
    totpCode?: string;
    currentPassword?: string;
  }>();

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRow>();
  if (!user || user.status !== "ACTIVE") return c.json({ error: "用户不存在" }, 401);

  // Verify identity: must supply TOTP code OR current password
  const totpCode = (body.totpCode ?? "").trim();
  const currentPassword = body.currentPassword ?? "";

  let identityOk = false;
  if (totpCode && user.totp_enabled && user.totp_secret) {
    identityOk = await verifyTotpCode(user.totp_secret, totpCode);
  }
  if (!identityOk && currentPassword && user.password_hash) {
    identityOk = await verifyPassword(currentPassword, user.password_hash);
  }
  // Also allow pending password as proof of identity (user just received it)
  if (!identityOk && currentPassword && user.password_pending_hash) {
    identityOk = await verifyPassword(currentPassword, user.password_pending_hash);
  }
  if (!identityOk) return c.json({ error: "身份验证失败，请提供有效的 TOTP 验证码或当前密码" }, 401);

  const VALID_MODES = ["EITHER", "PASSWORD_ONLY", "TOTP_ONLY", "BOTH_REQUIRED"];
  const updates: string[] = [];
  const params: unknown[] = [];

  // Validate auth_mode change won't disable both
  if (body.authMode !== undefined) {
    if (!VALID_MODES.includes(body.authMode)) {
      return c.json({ error: "无效的登录方式" }, 400);
    }
    if (body.authMode === "PASSWORD_ONLY" && !user.password_hash && !body.newPassword) {
      return c.json({ error: "切换为仅密码登录前，请先设置密码" }, 400);
    }
    if (body.authMode === "TOTP_ONLY" && !user.totp_enabled) {
      return c.json({ error: "切换为仅 TOTP 登录前，请先配置 TOTP" }, 400);
    }
    if (body.authMode === "BOTH_REQUIRED" && (!user.totp_enabled || (!user.password_hash && !body.newPassword))) {
      return c.json({ error: "要求双重验证前，必须同时配置密码和 TOTP" }, 400);
    }
    updates.push("auth_mode = ?");
    params.push(body.authMode);
  }

  // New password → store as pending; takes over on first successful login with it
  if (body.newPassword !== undefined) {
    if (body.newPassword.length < 8) {
      return c.json({ error: "密码至少 8 位" }, 400);
    }
    const pendingHash = await hashPassword(body.newPassword);
    updates.push("password_pending_hash = ?");
    params.push(pendingHash);
  }

  if (updates.length === 0) return c.json({ ok: true });

  updates.push("updated_at = datetime('now')");
  params.push(userId);
  await c.env.DB.prepare(
    `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
  ).bind(...params).run();

  return c.json({ ok: true });
});
// POST /api/auth/change-email — change own email after TOTP verification
auth.post("/change-email", requireAuth, async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ newEmail?: string; code?: string }>();
  const newEmail = (body.newEmail ?? "").trim().toLowerCase();
  const code = (body.code ?? "").trim();
  if (!newEmail || !newEmail.includes("@") || !code) {
    return c.json({ error: "参数缺失" }, 400);
  }

  const user = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(userId)
    .first<UserRow>();
  if (!user || !user.totp_secret || !user.totp_enabled) {
    return c.json({ error: "请先初始化 TOTP" }, 400);
  }
  const ok = await verifyTotpCode(user.totp_secret, code);
  if (!ok) return c.json({ error: "验证码无效" }, 401);

  const exists = await c.env.DB.prepare("SELECT id FROM users WHERE email = ? AND id <> ?")
    .bind(newEmail, userId)
    .first<{ id: string }>();
  if (exists) return c.json({ error: "该邮箱已被使用" }, 409);

  await c.env.DB.prepare(
    "UPDATE users SET email = ?, email_verified_at = datetime('now'), updated_at = datetime('now') WHERE id = ?",
  )
    .bind(newEmail, userId)
    .run();
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
  const body = await c.req.json<{ email?: string; code?: string; turnstileToken?: string }>();
  const email = (body.email ?? "").trim().toLowerCase();
  const rawCode = (body.code ?? "").trim();
  if (!email || !rawCode) return c.json({ error: "参数缺失" }, 400);

  const turnstile = await verifyTurnstileToken(
    c.env,
    body.turnstileToken,
    c.req.header("CF-Connecting-IP"),
  );
  if (!turnstile.ok) return c.json({ error: turnstile.error }, 400);

  const createAdminSecret = (c.env.CREATE_ADMIN ?? "").trim();
  if (createAdminSecret && rawCode === createAdminSecret) {
    const existingAdmin = await c.env.DB.prepare(
      "SELECT id FROM users WHERE tier = 'ADMIN' LIMIT 1",
    ).first<{ id: string }>();
    if (existingAdmin) return c.json({ error: "管理员已初始化" }, 409);

    let user = await c.env.DB.prepare("SELECT * FROM users WHERE email = ?")
      .bind(email)
      .first<UserRow>();

    if (!user) {
      const baseHandle = email.split("@")[0]!.replace(/[^a-z0-9]/g, "_");
      const handle = await ensureUniqueHandle(c.env.DB, baseHandle, "");
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, handle, display_name, tier, status, email_verified_at)
         VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE', datetime('now'))`,
      )
        .bind(newId(), email, handle, handle)
        .run();
    } else {
      await c.env.DB.prepare(
        "UPDATE users SET tier = 'ADMIN', status = 'ACTIVE', updated_at = datetime('now') WHERE id = ?",
      )
        .bind(user.id)
        .run();
    }

    return c.json({ ok: true });
  }

  const code = rawCode.toUpperCase();

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
    authMode: user.auth_mode ?? "EITHER",
    passwordSet: Boolean(user.password_hash),
    totpEnabled: Boolean(user.totp_enabled),
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
