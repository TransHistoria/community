#!/usr/bin/env tsx
/**
 * Create or promote a user to ADMIN.
 *
 * Usage:
 *   pnpm create-admin admin@example.com
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/create-admin.ts <email>");
    process.exit(1);
  }
  const normalized = email.trim().toLowerCase();

  const existing = await db.user.findUnique({ where: { email: normalized } });
  if (existing) {
    if (existing.tier === "ADMIN") {
      console.log(`${normalized} 已是 ADMIN，无需操作。`);
      return;
    }
    await db.user.update({
      where: { email: normalized },
      data: { tier: "ADMIN" },
    });
    console.log(`已提升 ${normalized} 为 ADMIN。`);
    return;
  }

  const handleBase = normalized.split("@")[0].replace(/[^a-z0-9]/g, "_");
  let handle = handleBase || "admin";
  let n = 0;
  while (await db.user.findUnique({ where: { handle } })) {
    n += 1;
    handle = `${handleBase}_${n}`;
  }

  await db.user.create({
    data: {
      email: normalized,
      handle,
      displayName: handleBase || "admin",
      tier: "ADMIN",
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`已创建 ADMIN 用户 ${normalized}（@${handle}）。`);
  console.log("你可以让 ta 直接用此邮箱在登录页登录（魔法链接）。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
