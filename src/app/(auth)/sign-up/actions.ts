"use server";

import { db } from "@/lib/db";
import { signUpInviteSchema, applicationSchema } from "@/lib/validators/auth";
import { jsonEncode } from "@/lib/json";
import { z } from "zod";

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string };

/**
 * Validates the invite code and stamps a pending grant. Auth.js then takes over
 * to send the magic link. After successful sign-in, the `events.createUser`
 * hook + this grant promote the new user to VERIFIED.
 *
 * For simplicity in MVP, the consumption of the invite code is finalized when
 * the user clicks the magic link (handled in `events.createUser` via a lookup
 * keyed by email). We pre-validate here for fast UX feedback.
 */
export async function consumeInvitePreCheck(input: {
  email: string;
  code: string;
}): Promise<ActionResult> {
  const parsed = signUpInviteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  const code = await db.inviteCode.findUnique({
    where: { code: parsed.data.code },
  });
  if (!code) return { ok: false, error: "邀请码不存在" };
  if (code.usedCount >= code.maxUses) return { ok: false, error: "邀请码已用完" };
  if (code.expiresAt && code.expiresAt < new Date())
    return { ok: false, error: "邀请码已过期" };

  // Stash a pending grant. Email is the binding key.
  await db.notification.create({
    data: {
      userId: code.issuerId,
      kind: "INVITE_PRECHECK",
      payload: jsonEncode({ email: parsed.data.email, code: parsed.data.code }),
    },
  });
  return { ok: true };
}

export async function submitApplication(
  input: z.input<typeof applicationSchema>,
): Promise<ActionResult> {
  const parsed = applicationSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  const { email, identity, motivation, vouch } = parsed.data;

  // Re-using a pending application is fine; reject if already approved
  const existing = await db.application.findFirst({
    where: { email, status: { in: ["PENDING", "APPROVED"] } },
    orderBy: { createdAt: "desc" },
  });
  if (existing?.status === "APPROVED") {
    return { ok: false, error: "该邮箱的申请已通过，请直接登录。" };
  }

  await db.application.create({
    data: {
      email,
      answers: jsonEncode({ identity, motivation, vouch: vouch ?? "" }),
    },
  });

  return { ok: true, message: "申请已提交，请耐心等待审核结果。" };
}
