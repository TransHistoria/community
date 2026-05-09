#!/usr/bin/env tsx
/**
 * CLI to issue an invite code on behalf of a user (or first ADMIN if none specified).
 *
 * Usage:
 *   pnpm issue-invite                                # issued by first ADMIN, no expiry
 *   pnpm issue-invite --as admin@example.com         # issued on behalf of given user
 *   pnpm issue-invite --note "for X" --days 14
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  return process.argv[i + 1];
}

function randomCode(len = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function main() {
  const asEmail = arg("as");
  const note = arg("note");
  const days = arg("days") ? Number(arg("days")) : undefined;

  let issuer = asEmail
    ? await db.user.findUnique({ where: { email: asEmail.toLowerCase() } })
    : await db.user.findFirst({ where: { tier: "ADMIN" }, orderBy: { createdAt: "asc" } });

  if (!issuer) {
    console.error("找不到签发者。请先 pnpm create-admin <email>。");
    process.exit(1);
  }

  let code = "";
  for (let i = 0; i < 8; i += 1) {
    code = randomCode(8);
    if (!(await db.inviteCode.findUnique({ where: { code } }))) break;
  }

  await db.inviteCode.create({
    data: {
      code,
      issuerId: issuer.id,
      maxUses: 1,
      note: note ?? null,
      expiresAt: days && days > 0 ? new Date(Date.now() + days * 86400_000) : null,
    },
  });

  console.log(`已签发邀请码：${code}`);
  console.log(`签发人：@${issuer.handle} (${issuer.email})`);
  if (days) console.log(`有效期：${days} 天`);
  if (note) console.log(`备注：${note}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
