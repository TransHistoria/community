"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";

export async function exportMyData() {
  const viewer = await requireUser();
  const [user, contacts, contactRequestsSent, contactRequestsRecvd, registrations, comments, events, blocks] = await Promise.all([
    db.user.findUnique({
      where: { id: viewer.id },
      select: {
        id: true,
        email: true,
        handle: true,
        displayName: true,
        pronouns: true,
        genderIdentity: true,
        bio: true,
        tier: true,
        createdAt: true,
      },
    }),
    db.contactMethod.findMany({ where: { userId: viewer.id } }),
    db.contactRequest.findMany({ where: { requesterId: viewer.id } }),
    db.contactRequest.findMany({ where: { targetId: viewer.id } }),
    db.registration.findMany({
      where: { userId: viewer.id },
      include: { event: { select: { title: true, startAt: true, slug: true } } },
    }),
    db.comment.findMany({
      where: { authorId: viewer.id },
      select: { id: true, body: true, eventId: true, createdAt: true },
    }),
    db.event.findMany({
      where: { organizerId: viewer.id },
      select: { id: true, title: true, slug: true, startAt: true },
    }),
    db.block.findMany({ where: { blockerId: viewer.id } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    user,
    contacts,
    contactRequestsSent,
    contactRequestsRecvd,
    registrations,
    comments,
    events,
    blocks,
  };
}

export async function scheduleAccountDeletion(confirm: string) {
  const viewer = await requireUser();
  if (confirm !== "DELETE") {
    return { ok: false as const, error: "请输入 DELETE 以确认" };
  }
  await db.user.update({
    where: { id: viewer.id },
    data: {
      status: "SUSPENDED",
      scheduledDeletionAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return { ok: true as const };
}
