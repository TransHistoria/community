"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canViewEvent } from "@/lib/access";
import {
  shareToManySchema,
  userSearchSchema,
} from "@/lib/validators/share";
import { jsonEncode } from "@/lib/json";
import type { z } from "zod";

const SHARE_LIMIT_PER_HOUR = 10;

export async function searchSharableUsers(
  input: z.input<typeof userSearchSchema>,
) {
  const viewer = await requireUser();
  const parsed = userSearchSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "参数有误" };

  const q = parsed.data.q.trim();
  if (!q) return { ok: true as const, results: [] };

  // Block-aware: exclude users I've blocked OR who have blocked me.
  const blocks = await db.block.findMany({
    where: { OR: [{ blockerId: viewer.id }, { blockedId: viewer.id }] },
  });
  const excludedIds = Array.from(
    new Set([
      viewer.id,
      ...blocks.map((b) =>
        b.blockerId === viewer.id ? b.blockedId : b.blockerId,
      ),
    ]),
  );

  const results = await db.user.findMany({
    where: {
      status: "ACTIVE",
      tier: { in: ["VERIFIED", "TRUSTED", "ADMIN"] },
      id: { notIn: excludedIds },
      OR: [
        { handle: { contains: q.toLowerCase() } },
        { displayName: { contains: q } },
      ],
    },
    select: {
      id: true,
      handle: true,
      displayName: true,
      avatarUrl: true,
      tier: true,
    },
    take: 10,
    orderBy: { handle: "asc" },
  });

  return { ok: true as const, results };
}

export async function shareEventToUsers(
  input: z.input<typeof shareToManySchema>,
) {
  const viewer = await requireUser();
  const parsed = shareToManySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "参数有误" };
  }

  const event = await db.event.findUnique({
    where: { id: parsed.data.eventId },
    select: {
      id: true,
      slug: true,
      title: true,
      visibility: true,
      status: true,
      organizerId: true,
    },
  });
  if (!event) return { ok: false as const, error: "活动不存在" };
  if (!canViewEvent(viewer, event)) {
    return { ok: false as const, error: "无权访问此活动" };
  }

  // Rate limit: count recommendation notifications I've sent in past hour.
  // SQLite has no JSON path filter, so we substring-match the encoded payload.
  // The fromId is a cuid, unlikely to collide.
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.notification.count({
    where: {
      kind: "EVENT_RECOMMENDATION",
      createdAt: { gte: since },
      payload: { contains: `"fromId":"${viewer.id}"` },
    },
  });
  if (recent + parsed.data.recipientIds.length > SHARE_LIMIT_PER_HOUR) {
    return {
      ok: false as const,
      error: `每小时最多分享 ${SHARE_LIMIT_PER_HOUR} 次，请稍后再试`,
    };
  }

  // Validate recipients: active, not blocked in either direction.
  const recipients = await db.user.findMany({
    where: {
      id: { in: parsed.data.recipientIds },
      status: "ACTIVE",
      tier: { in: ["VERIFIED", "TRUSTED", "ADMIN"] },
    },
    select: { id: true },
  });
  const valid = new Set(recipients.map((r) => r.id));
  if (valid.size === 0) {
    return { ok: false as const, error: "未找到可分享的成员" };
  }

  const blocks = await db.block.findMany({
    where: {
      OR: [
        { blockerId: viewer.id, blockedId: { in: [...valid] } },
        { blockedId: viewer.id, blockerId: { in: [...valid] } },
      ],
    },
  });
  for (const b of blocks) {
    valid.delete(b.blockerId);
    valid.delete(b.blockedId);
  }
  valid.delete(viewer.id);

  if (valid.size === 0) {
    return { ok: false as const, error: "没有可分享的对象" };
  }

  await db.notification.createMany({
    data: [...valid].map((recipientId) => ({
      userId: recipientId,
      kind: "EVENT_RECOMMENDATION",
      payload: jsonEncode({
        fromId: viewer.id,
        fromHandle: viewer.handle,
        fromName: viewer.displayName,
        eventTitle: event.title,
        slug: event.slug,
      }),
    })),
  });

  return { ok: true as const, sent: valid.size };
}
