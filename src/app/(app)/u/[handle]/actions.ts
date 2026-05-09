"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser, requireTier } from "@/lib/session";
import { contactRequestSchema } from "@/lib/validators/user";
import { sendContactRequestEmail } from "@/lib/mail/sender";
import { env } from "@/lib/env";
import { jsonEncode } from "@/lib/json";

export async function requestContact(input: {
  targetHandle: string;
  contactId?: string;
  reason: string;
}) {
  const viewer = await requireTier("VERIFIED");
  const parsed = contactRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "参数有误" };
  }

  const target = await db.user.findUnique({
    where: { handle: parsed.data.targetHandle.toLowerCase() },
    select: { id: true, email: true, displayName: true, status: true },
  });
  if (!target || target.status !== "ACTIVE") {
    return { ok: false as const, error: "用户不存在" };
  }
  if (target.id === viewer.id) {
    return { ok: false as const, error: "无法对自己发起申请" };
  }

  // Check block in either direction
  const blocked = await db.block.findFirst({
    where: {
      OR: [
        { blockerId: viewer.id, blockedId: target.id },
        { blockerId: target.id, blockedId: viewer.id },
      ],
    },
  });
  if (blocked) return { ok: false as const, error: "无法发起申请" };

  // If contactId is provided, validate it belongs to target
  if (parsed.data.contactId) {
    const c = await db.contactMethod.findFirst({
      where: { id: parsed.data.contactId, userId: target.id },
    });
    if (!c) return { ok: false as const, error: "联系项不存在" };
    if (c.visibility !== "HIDDEN_REQUEST") {
      return { ok: false as const, error: "该项不需要申请" };
    }
  }

  const existing = await db.contactRequest.findFirst({
    where: {
      requesterId: viewer.id,
      targetId: target.id,
      contactId: parsed.data.contactId ?? null,
      status: { in: ["PENDING", "APPROVED"] },
    },
  });
  if (existing) {
    return {
      ok: false as const,
      error: existing.status === "APPROVED" ? "已经获得授权" : "已发送过申请，正在等待回复",
    };
  }

  await db.contactRequest.create({
    data: {
      requesterId: viewer.id,
      targetId: target.id,
      contactId: parsed.data.contactId ?? null,
      reason: parsed.data.reason,
    },
  });

  await db.notification.create({
    data: {
      userId: target.id,
      kind: "CONTACT_REQ",
      payload: jsonEncode({
        requesterHandle: viewer.handle,
        requesterName: viewer.displayName,
        reason: parsed.data.reason,
      }),
    },
  });

  if (target.email) {
    await sendContactRequestEmail({
      to: target.email,
      requesterName: viewer.displayName,
      reason: parsed.data.reason,
      url: `${env.auth.url ?? ""}/me/contact-requests`,
    }).catch(() => {});
  }

  return { ok: true as const };
}

export async function blockUser(targetUserId: string) {
  const viewer = await requireUser();
  if (targetUserId === viewer.id) {
    return { ok: false as const, error: "无法拉黑自己" };
  }
  await db.block.upsert({
    where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: targetUserId } },
    update: {},
    create: { blockerId: viewer.id, blockedId: targetUserId },
  });
  revalidatePath("/me/blocks");
  return { ok: true as const };
}

export async function unblockUser(targetUserId: string) {
  const viewer = await requireUser();
  await db.block
    .delete({
      where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: targetUserId } },
    })
    .catch(() => {});
  revalidatePath("/me/blocks");
  return { ok: true as const };
}
