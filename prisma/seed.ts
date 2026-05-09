import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  for (const email of adminEmails) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.tier !== "ADMIN") {
        await prisma.user.update({
          where: { email },
          data: { tier: "ADMIN" },
        });
        console.log(`[seed] Promoted ${email} → ADMIN`);
      } else {
        console.log(`[seed] ${email} already ADMIN`);
      }
      continue;
    }
    const handle = email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "_");
    await prisma.user.create({
      data: {
        email,
        handle: await uniqueHandle(handle),
        displayName: handle,
        tier: "ADMIN",
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`[seed] Created ADMIN user ${email}`);
  }

  console.log("[seed] Done.");
}

async function uniqueHandle(base: string) {
  let candidate = base || "user";
  let n = 0;
  while (await prisma.user.findUnique({ where: { handle: candidate } })) {
    n += 1;
    candidate = `${base}_${n}`;
  }
  return candidate;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
