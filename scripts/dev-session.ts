#!/usr/bin/env tsx
/**
 * Dev-only: mint a Session row for the given email and print the cookie value.
 * Use with: pnpm tsx scripts/dev-session.ts admin@example.com
 *
 * Then set cookie in browser: authjs.session-token=<value>
 */

import { PrismaClient } from "@prisma/client";
import crypto from "node:crypto";

const db = new PrismaClient();

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("Usage: tsx scripts/dev-session.ts <email>");
    process.exit(1);
  }
  const user = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user) {
    console.error(`No user found for ${email}. Run pnpm create-admin first.`);
    process.exit(1);
  }

  const sessionToken = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: { sessionToken, userId: user.id, expires },
  });

  console.log(JSON.stringify({
    cookieName: "authjs.session-token",
    cookieValue: sessionToken,
    expires: expires.toISOString(),
    user: { id: user.id, email: user.email, handle: user.handle, tier: user.tier },
  }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
