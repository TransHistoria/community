"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireTier } from "@/lib/session";
import {
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
} from "@/lib/mail/sender";
import type { UserTier } from "@/lib/enums";
import { jsonEncodeNullable } from "@/lib/json";

async function audit(actorId: string, action: string, targetType: string, targetId: string, meta?: object) {
  await db.auditLog.create({
    data: { actorId, action, targetType, targetId, meta: jsonEncodeNullable(meta) },
  });
}

export async function approveApplication(applicationId: string, note?: string) {
  const viewer = await requireTier("ADMIN");
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) return { ok: false as const, error: "申请不存在" };
  if (app.status !== "PENDING") return { ok: false as const, error: "已处理过" };

  await db.application.update({
    where: { id: applicationId },
    data: {
      status: "APPROVED",
      reviewerId: viewer.id,
      reviewerNote: note,
      reviewedAt: new Date(),
    },
  });
  // If a user with this email already exists, promote them
  await db.user.updateMany({
    where: { email: app.email, tier: { in: ["GUEST", "UNVERIFIED"] } },
    data: { tier: "VERIFIED", applicationId },
  });

  await sendApplicationApprovedEmail({ to: app.email }).catch(() => {});
  await audit(viewer.id, "APPLICATION_APPROVE", "Application", applicationId);
  revalidatePath("/admin/applications");
  return { ok: true as const };
}

export async function rejectApplication(applicationId: string, note?: string) {
  const viewer = await requireTier("ADMIN");
  const app = await db.application.findUnique({ where: { id: applicationId } });
  if (!app) return { ok: false as const, error: "申请不存在" };
  if (app.status !== "PENDING") return { ok: false as const, error: "已处理过" };

  await db.application.update({
    where: { id: applicationId },
    data: {
      status: "REJECTED",
      reviewerId: viewer.id,
      reviewerNote: note,
      reviewedAt: new Date(),
    },
  });
  await sendApplicationRejectedEmail({ to: app.email, note }).catch(() => {});
  await audit(viewer.id, "APPLICATION_REJECT", "Application", applicationId, { note });
  revalidatePath("/admin/applications");
  return { ok: true as const };
}

export async function setUserTier(userId: string, tier: UserTier) {
  const viewer = await requireTier("ADMIN");
  if (userId === viewer.id && tier !== "ADMIN") {
    return { ok: false as const, error: "不能降级自己" };
  }
  await db.user.update({ where: { id: userId }, data: { tier } });
  await audit(viewer.id, "USER_TIER_SET", "User", userId, { tier });
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function suspendUser(userId: string) {
  const viewer = await requireTier("ADMIN");
  await db.user.update({
    where: { id: userId },
    data: { status: "SUSPENDED" },
  });
  await audit(viewer.id, "USER_SUSPEND", "User", userId);
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function reactivateUser(userId: string) {
  const viewer = await requireTier("ADMIN");
  await db.user.update({
    where: { id: userId },
    data: { status: "ACTIVE", scheduledDeletionAt: null },
  });
  await audit(viewer.id, "USER_REACTIVATE", "User", userId);
  revalidatePath("/admin/users");
  return { ok: true as const };
}

export async function resolveReport(
  reportId: string,
  decision: "RESOLVED" | "DISMISSED",
  note?: string,
  hideTarget?: boolean,
) {
  const viewer = await requireTier("ADMIN");
  const r = await db.report.findUnique({ where: { id: reportId } });
  if (!r) return { ok: false as const, error: "举报不存在" };

  if (hideTarget && decision === "RESOLVED") {
    if (r.targetType === "COMMENT") {
      await db.comment.update({
        where: { id: r.targetId },
        data: { isHidden: true, hiddenReason: "管理员处理（举报）" },
      });
    } else if (r.targetType === "EVENT") {
      await db.event.update({
        where: { id: r.targetId },
        data: { status: "CANCELLED" },
      });
    } else if (r.targetType === "USER") {
      await db.user.update({
        where: { id: r.targetId },
        data: { status: "SUSPENDED" },
      });
    }
  }

  await db.report.update({
    where: { id: reportId },
    data: {
      status: decision,
      resolvedById: viewer.id,
      resolvedNote: note,
      resolvedAt: new Date(),
    },
  });
  await audit(viewer.id, "REPORT_RESOLVE", "Report", reportId, { decision, hideTarget });
  revalidatePath("/admin/reports");
  return { ok: true as const };
}
