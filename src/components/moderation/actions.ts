"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { z } from "zod";

const reportSchema = z.object({
  targetType: z.enum(["USER", "EVENT", "COMMENT"]),
  targetId: z.string().min(1),
  reason: z.string().min(10).max(2000),
});

export async function submitReport(input: z.input<typeof reportSchema>) {
  const viewer = await requireUser();
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "参数有误" };
  }

  // Soft rate limit: max 5 open reports / 10min from same user
  const recent = await db.report.count({
    where: {
      reporterId: viewer.id,
      createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
    },
  });
  if (recent >= 5) {
    return { ok: false as const, error: "操作太频繁，请稍后再试" };
  }

  await db.report.create({
    data: {
      reporterId: viewer.id,
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      reason: parsed.data.reason,
    },
  });
  return { ok: true as const };
}
