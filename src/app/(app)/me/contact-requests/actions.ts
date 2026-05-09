"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { jsonEncode } from "@/lib/json";

export async function decideContactRequest(
  id: string,
  decision: "APPROVED" | "DECLINED",
) {
  const viewer = await requireUser();
  const req = await db.contactRequest.findUnique({ where: { id } });
  if (!req || req.targetId !== viewer.id) {
    return { ok: false as const, error: "无权操作" };
  }
  if (req.status !== "PENDING") {
    return { ok: false as const, error: "已经处理过" };
  }
  await db.contactRequest.update({
    where: { id },
    data: { status: decision, decidedAt: new Date() },
  });
  await db.notification.create({
    data: {
      userId: req.requesterId,
      kind: decision === "APPROVED" ? "CONTACT_REQ_APPROVED" : "CONTACT_REQ_DECLINED",
      payload: jsonEncode({ targetHandle: viewer.handle }),
    },
  });
  revalidatePath("/me/contact-requests");
  return { ok: true as const };
}
