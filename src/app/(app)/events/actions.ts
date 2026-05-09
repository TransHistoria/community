"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireTier, requireUser } from "@/lib/session";
import { canCreateEvent, canEditEvent, canRegister } from "@/lib/access";
import { eventInputSchema, registrationInputSchema, commentSchema } from "@/lib/validators/event";
import { containsBlockedTerms } from "@/lib/moderation/keywords";
import { sendRegistrationStatusEmail } from "@/lib/mail/sender";
import { slugify, randomCode } from "@/lib/utils";
import { env } from "@/lib/env";
import { jsonEncode } from "@/lib/json";
import type { z } from "zod";

async function uniqueSlug(base: string): Promise<string> {
  const stem = slugify(base) || "event";
  let candidate = stem;
  for (let i = 0; i < 5; i += 1) {
    const exists = await db.event.findUnique({ where: { slug: candidate } });
    if (!exists) return candidate;
    candidate = `${stem}-${randomCode(4).toLowerCase()}`;
  }
  return `${stem}-${randomCode(6).toLowerCase()}`;
}

export async function createEvent(input: z.input<typeof eventInputSchema>) {
  const viewer = await requireTier("VERIFIED");
  if (!canCreateEvent(viewer)) {
    return { ok: false as const, error: "无权创建" };
  }
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }
  if (containsBlockedTerms(`${parsed.data.title} ${parsed.data.description}`)) {
    return { ok: false as const, error: "内容包含被屏蔽的词汇" };
  }

  const slug = await uniqueSlug(parsed.data.title);
  const event = await db.event.create({
    data: {
      organizerId: viewer.id,
      title: parsed.data.title,
      slug,
      description: parsed.data.description,
      category: parsed.data.category,
      format: parsed.data.format,
      coverUrl: parsed.data.coverUrl || null,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      timezone: parsed.data.timezone,
      city: parsed.data.city || null,
      preciseAddr: parsed.data.preciseAddr || null,
      onlineUrl: parsed.data.onlineUrl || null,
      capacity: parsed.data.capacity ?? null,
      requireApproval: parsed.data.requireApproval,
      registrationOpensAt: parsed.data.registrationOpensAt ?? null,
      registrationClosesAt: parsed.data.registrationClosesAt ?? null,
      customQuestions: jsonEncode(parsed.data.customQuestions ?? []),
      visibility: parsed.data.visibility,
    },
  });
  revalidatePath("/events");
  return { ok: true as const, slug: event.slug };
}

export async function updateEvent(
  id: string,
  input: z.input<typeof eventInputSchema>,
) {
  const viewer = await requireUser();
  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, error: "活动不存在" };
  if (!canEditEvent(viewer, existing)) {
    return { ok: false as const, error: "无权编辑" };
  }
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }

  await db.event.update({
    where: { id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      category: parsed.data.category,
      format: parsed.data.format,
      coverUrl: parsed.data.coverUrl || null,
      startAt: parsed.data.startAt,
      endAt: parsed.data.endAt,
      timezone: parsed.data.timezone,
      city: parsed.data.city || null,
      preciseAddr: parsed.data.preciseAddr || null,
      onlineUrl: parsed.data.onlineUrl || null,
      capacity: parsed.data.capacity ?? null,
      requireApproval: parsed.data.requireApproval,
      registrationOpensAt: parsed.data.registrationOpensAt ?? null,
      registrationClosesAt: parsed.data.registrationClosesAt ?? null,
      customQuestions: jsonEncode(parsed.data.customQuestions ?? []),
      visibility: parsed.data.visibility,
    },
  });
  revalidatePath("/events");
  revalidatePath(`/events/${existing.slug}`);
  return { ok: true as const };
}

export async function cancelEvent(id: string) {
  const viewer = await requireUser();
  const existing = await db.event.findUnique({ where: { id } });
  if (!existing) return { ok: false as const, error: "活动不存在" };
  if (!canEditEvent(viewer, existing)) {
    return { ok: false as const, error: "无权操作" };
  }
  await db.event.update({ where: { id }, data: { status: "CANCELLED" } });

  const regs = await db.registration.findMany({
    where: { eventId: id, status: { in: ["CONFIRMED", "WAITLIST", "PENDING"] } },
    include: { user: { select: { email: true } } },
  });
  for (const r of regs) {
    await db.notification.create({
      data: {
        userId: r.userId,
        kind: "EVENT_CANCELLED",
        payload: jsonEncode({ eventTitle: existing.title, slug: existing.slug }),
      },
    });
  }
  revalidatePath("/events");
  revalidatePath(`/events/${existing.slug}`);
  return { ok: true as const };
}

export async function register(
  input: z.input<typeof registrationInputSchema>,
) {
  const viewer = await requireUser();
  const parsed = registrationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "参数有误" };

  const event = await db.event.findUnique({ where: { id: parsed.data.eventId } });
  if (!event) return { ok: false as const, error: "活动不存在" };

  const allowed = canRegister(viewer, event);
  if (!allowed.ok) return { ok: false as const, error: allowed.reason };

  // capacity / waitlist
  const confirmedCount = await db.registration.count({
    where: { eventId: event.id, status: { in: ["CONFIRMED", "CHECKED_IN"] } },
  });
  const overCap = event.capacity != null && confirmedCount >= event.capacity;

  const status = event.requireApproval
    ? "PENDING"
    : overCap
      ? "WAITLIST"
      : "CONFIRMED";

  const reg = await db.registration.upsert({
    where: { eventId_userId: { eventId: event.id, userId: viewer.id } },
    create: {
      eventId: event.id,
      userId: viewer.id,
      status,
      answers: jsonEncode(parsed.data.answers ?? {}),
    },
    update: {
      status,
      answers: jsonEncode(parsed.data.answers ?? {}),
    },
  });

  // Notify organizer
  await db.notification.create({
    data: {
      userId: event.organizerId,
      kind: "REG_NEW",
      payload: jsonEncode({
        eventTitle: event.title,
        slug: event.slug,
        applicantHandle: viewer.handle,
        status,
      }),
    },
  });

  // Notify applicant
  await db.notification.create({
    data: {
      userId: viewer.id,
      kind:
        status === "CONFIRMED"
          ? "REG_CONFIRMED"
          : status === "WAITLIST"
            ? "REG_WAITLIST"
            : "REG_PENDING",
      payload: jsonEncode({ eventTitle: event.title, slug: event.slug }),
    },
  });

  const userEmail = (await db.user.findUnique({ where: { id: viewer.id } }))
    ?.email;
  if (userEmail) {
    await sendRegistrationStatusEmail({
      to: userEmail,
      eventTitle: event.title,
      eventUrl: `${env.auth.url ?? ""}/events/${event.slug}`,
      status,
    }).catch(() => {});
  }

  revalidatePath(`/events/${event.slug}`);
  return { ok: true as const, status };
}

export async function decideRegistration(
  registrationId: string,
  decision: "CONFIRMED" | "DECLINED" | "WAITLIST" | "CHECKED_IN" | "NO_SHOW",
) {
  const viewer = await requireUser();
  const reg = await db.registration.findUnique({
    where: { id: registrationId },
    include: { event: true, user: { select: { email: true } } },
  });
  if (!reg) return { ok: false as const, error: "记录不存在" };
  if (!canEditEvent(viewer, reg.event)) {
    return { ok: false as const, error: "无权操作" };
  }
  await db.registration.update({
    where: { id: registrationId },
    data: { status: decision },
  });

  if (["CONFIRMED", "WAITLIST", "DECLINED"].includes(decision) && reg.user.email) {
    await sendRegistrationStatusEmail({
      to: reg.user.email,
      eventTitle: reg.event.title,
      eventUrl: `${env.auth.url ?? ""}/events/${reg.event.slug}`,
      status: decision as "CONFIRMED" | "WAITLIST" | "DECLINED",
    }).catch(() => {});
  }

  revalidatePath(`/events/${reg.event.slug}`);
  revalidatePath(`/events/${reg.event.slug}/manage`);
  return { ok: true as const };
}

export async function cancelMyRegistration(eventId: string) {
  const viewer = await requireUser();
  const reg = await db.registration.findUnique({
    where: { eventId_userId: { eventId, userId: viewer.id } },
  });
  if (!reg) return { ok: false as const, error: "未报名" };
  await db.registration.update({
    where: { id: reg.id },
    data: { status: "CANCELLED" },
  });
  const event = await db.event.findUnique({ where: { id: eventId } });
  revalidatePath(`/events/${event?.slug}`);
  return { ok: true as const };
}

export async function postComment(input: z.input<typeof commentSchema>) {
  const viewer = await requireTier("VERIFIED");
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "参数有误" };

  if (containsBlockedTerms(parsed.data.body)) {
    return { ok: false as const, error: "评论包含被屏蔽的词汇" };
  }

  const event = await db.event.findUnique({
    where: { id: parsed.data.eventId },
    select: { slug: true },
  });
  if (!event) return { ok: false as const, error: "活动不存在" };

  await db.comment.create({
    data: {
      eventId: parsed.data.eventId,
      authorId: viewer.id,
      body: parsed.data.body,
      parentId: parsed.data.parentId || null,
    },
  });
  revalidatePath(`/events/${event.slug}`);
  return { ok: true as const };
}

export async function hideComment(id: string) {
  const viewer = await requireUser();
  const c = await db.comment.findUnique({
    where: { id },
    include: { event: { select: { organizerId: true, slug: true } } },
  });
  if (!c) return { ok: false as const, error: "评论不存在" };
  const isOrganizer = c.event.organizerId === viewer.id;
  if (!isOrganizer && viewer.tier !== "ADMIN") {
    return { ok: false as const, error: "无权操作" };
  }
  await db.comment.update({
    where: { id },
    data: { isHidden: true, hiddenReason: viewer.tier === "ADMIN" ? "管理员处理" : "组织者处理" },
  });
  revalidatePath(`/events/${c.event.slug}`);
  return { ok: true as const };
}
