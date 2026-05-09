"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { canIssueInvites, inviteQuotaPerQuarter } from "@/lib/access";
import { randomCode } from "@/lib/utils";

function quarterStart() {
  const d = new Date();
  return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
}

export async function createInvite(input: { note?: string; expiresInDays?: number }) {
  const viewer = await requireUser();
  if (!canIssueInvites(viewer)) {
    return { ok: false as const, error: "当前等级不能签发邀请码" };
  }

  const used = await db.inviteCode.count({
    where: { issuerId: viewer.id, createdAt: { gte: quarterStart() } },
  });
  if (used >= inviteQuotaPerQuarter(viewer.tier)) {
    return { ok: false as const, error: "本季度配额已用完" };
  }

  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code = randomCode(8);
    const exists = await db.inviteCode.findUnique({ where: { code } });
    if (!exists) break;
  }

  const expiresAt =
    input.expiresInDays && input.expiresInDays > 0
      ? new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

  await db.inviteCode.create({
    data: {
      code,
      issuerId: viewer.id,
      maxUses: 1,
      note: input.note?.trim() || null,
      expiresAt,
    },
  });

  revalidatePath("/me/invites");
  return { ok: true as const, code };
}
