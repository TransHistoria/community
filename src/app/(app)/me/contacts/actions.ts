"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { contactSchema } from "@/lib/validators/user";
import type { z } from "zod";

export async function addContact(input: z.input<typeof contactSchema>) {
  const viewer = await requireUser();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }
  const max = await db.contactMethod.aggregate({
    where: { userId: viewer.id },
    _max: { order: true },
  });
  const created = await db.contactMethod.create({
    data: {
      userId: viewer.id,
      kind: parsed.data.kind,
      value: parsed.data.value.trim(),
      label: parsed.data.label?.trim() || null,
      visibility: parsed.data.visibility,
      order: (max._max.order ?? 0) + 1,
    },
  });
  revalidatePath("/me/contacts");
  revalidatePath(`/u/${viewer.handle}`);
  return { ok: true as const, contact: created };
}

export async function updateContact(
  id: string,
  input: z.input<typeof contactSchema>,
) {
  const viewer = await requireUser();
  const parsed = contactSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }
  const existing = await db.contactMethod.findUnique({ where: { id } });
  if (!existing || existing.userId !== viewer.id) {
    return { ok: false as const, error: "无权编辑该项" };
  }
  await db.contactMethod.update({
    where: { id },
    data: {
      kind: parsed.data.kind,
      value: parsed.data.value.trim(),
      label: parsed.data.label?.trim() || null,
      visibility: parsed.data.visibility,
    },
  });
  revalidatePath("/me/contacts");
  revalidatePath(`/u/${viewer.handle}`);
  return { ok: true as const };
}

export async function deleteContact(id: string) {
  const viewer = await requireUser();
  const existing = await db.contactMethod.findUnique({ where: { id } });
  if (!existing || existing.userId !== viewer.id) {
    return { ok: false as const, error: "无权删除" };
  }
  await db.contactMethod.delete({ where: { id } });
  revalidatePath("/me/contacts");
  revalidatePath(`/u/${viewer.handle}`);
  return { ok: true as const };
}
