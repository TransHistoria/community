"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { profileSchema } from "@/lib/validators/user";
import { containsBlockedTerms } from "@/lib/moderation/keywords";
import { saveImage } from "@/lib/storage";
import type { z } from "zod";

export async function saveProfile(input: z.input<typeof profileSchema>) {
  const viewer = await requireUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "校验失败" };
  }
  const { handle, displayName, pronouns, genderIdentity, bio } = parsed.data;

  if (containsBlockedTerms(`${displayName} ${pronouns ?? ""} ${genderIdentity ?? ""} ${bio ?? ""}`)) {
    return { ok: false as const, error: "包含被屏蔽的词汇，请调整后再保存" };
  }

  if (handle !== viewer.handle) {
    const conflict = await db.user.findUnique({ where: { handle } });
    if (conflict && conflict.id !== viewer.id) {
      return { ok: false as const, error: "该 handle 已被占用" };
    }
  }

  await db.user.update({
    where: { id: viewer.id },
    data: {
      handle,
      displayName,
      pronouns: pronouns || null,
      genderIdentity: genderIdentity || null,
      bio: bio || null,
    },
  });

  revalidatePath(`/u/${handle}`);
  revalidatePath("/me");
  return { ok: true as const, handle };
}

export async function uploadAvatar(formData: FormData) {
  const viewer = await requireUser();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false as const, error: "未选择文件" };
  }
  if (file.size > 4 * 1024 * 1024) {
    return { ok: false as const, error: "图片需小于 4MB" };
  }
  const url = await saveImage({
    userId: viewer.id,
    file,
    purpose: "avatar",
    targetSize: 384,
  });
  await db.user.update({
    where: { id: viewer.id },
    data: { avatarUrl: url },
  });
  revalidatePath("/me");
  revalidatePath(`/u/${viewer.handle}`);
  return { ok: true as const, url };
}
