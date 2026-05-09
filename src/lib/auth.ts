import NextAuth, { type DefaultSession } from "next-auth";
import Nodemailer from "next-auth/providers/nodemailer";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { UserTier } from "@/lib/enums";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { sendVerificationEmail } from "@/lib/mail/sender";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      handle: string;
      displayName: string;
      tier: UserTier;
      avatarUrl?: string | null;
    } & DefaultSession["user"];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  secret: env.auth.secret,
  session: { strategy: "database" },
  pages: {
    signIn: "/sign-in",
    verifyRequest: "/sign-in/check-email",
    error: "/sign-in",
  },
  providers: [
    Nodemailer({
      // Keep the legacy "email" id so existing client code works.
      id: "email",
      name: "Email",
      // Server settings are only used if RESEND_API_KEY is empty AND SMTP_* are set.
      // Either way, we override sendVerificationRequest to route through our renderer.
      server: env.email.smtp.host
        ? {
            host: env.email.smtp.host,
            port: Number(env.email.smtp.port ?? 587),
            auth: env.email.smtp.user
              ? { user: env.email.smtp.user, pass: env.email.smtp.pass ?? "" }
              : undefined,
          }
        : { host: "smtp.example.com", port: 587 },
      from: env.email.from,
      maxAge: 60 * 30,
      async sendVerificationRequest({ identifier, url }) {
        await sendVerificationEmail({ to: identifier, url });
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      const dbUser = await db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          handle: true,
          displayName: true,
          tier: true,
          avatarUrl: true,
          email: true,
          status: true,
        },
      });
      if (!dbUser || dbUser.status !== "ACTIVE") {
        session.user = {
          ...session.user,
          id: "",
          tier: "GUEST",
        } as typeof session.user;
        return session;
      }
      session.user = {
        ...session.user,
        id: dbUser.id,
        handle: dbUser.handle,
        displayName: dbUser.displayName,
        tier: dbUser.tier as UserTier,
        avatarUrl: dbUser.avatarUrl,
      };
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      // First-time login bootstrapping. Determines starting tier and handle.
      if (!user.id) return; // adapter contract: id is set when this fires
      const userId = user.id;
      const email = user.email?.toLowerCase();
      const isAdmin = !!email && env.app.adminEmails.includes(email);

      const baseHandle = email
        ? email.split("@")[0].replace(/[^a-z0-9]/g, "_")
        : "user";
      const handle = await ensureUniqueHandle(baseHandle, userId);

      let tier: UserTier = "UNVERIFIED";
      let invitedById: string | null = null;

      if (isAdmin) {
        tier = "ADMIN";
      } else if (email) {
        // 1) Check pending invite-code grant (recorded by InviteSignUpForm).
        // SQLite stores payload as TEXT; substring-match the JSON-encoded email.
        const recent = await db.notification.findFirst({
          where: {
            kind: "INVITE_PRECHECK",
            payload: { contains: `"email":"${email}"` },
            createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
          },
          orderBy: { createdAt: "desc" },
        });
        const payload = recent
          ? (JSON.parse(recent.payload) as { email?: string; code?: string })
          : null;
        if (payload?.code && payload.email?.toLowerCase() === email) {
          const code = await db.inviteCode.findUnique({
            where: { code: payload.code },
          });
          if (
            code &&
            code.usedCount < code.maxUses &&
            (!code.expiresAt || code.expiresAt >= new Date())
          ) {
            await db.inviteCode.update({
              where: { code: code.code },
              data: { usedCount: { increment: 1 } },
            });
            tier = "VERIFIED";
            invitedById = code.issuerId;
          }
        }
        // 2) If no invite, but there's an approved application, promote.
        if (tier === "UNVERIFIED") {
          const app = await db.application.findFirst({
            where: { email, status: "APPROVED" },
            orderBy: { reviewedAt: "desc" },
          });
          if (app) tier = "VERIFIED";
        }
      }

      await db.user.update({
        where: { id: userId },
        data: {
          handle,
          displayName: user.name ?? handle,
          tier,
          invitedById,
          emailVerifiedAt: new Date(),
        },
      });
    },
  },
});

async function ensureUniqueHandle(
  base: string,
  selfId: string,
): Promise<string> {
  let candidate = base || "user";
  let n = 0;
  while (true) {
    const conflict = await db.user.findUnique({
      where: { handle: candidate },
    });
    if (!conflict || conflict.id === selfId) return candidate;
    n += 1;
    candidate = `${base}_${n}`;
  }
}
