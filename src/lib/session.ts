import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { UserTier } from "@/lib/enums";

export type SessionUser = {
  id: string;
  email?: string | null;
  handle: string;
  displayName: string;
  tier: UserTier;
  avatarUrl?: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  return user;
}

export async function requireTier(min: UserTier): Promise<SessionUser> {
  const user = await requireUser();
  if (!tierAtLeast(user.tier, min)) {
    redirect("/sign-up?need=" + min.toLowerCase());
  }
  return user;
}

export const TIER_RANK: Record<UserTier, number> = {
  GUEST: 0,
  UNVERIFIED: 1,
  VERIFIED: 2,
  TRUSTED: 3,
  ADMIN: 4,
};

export function tierAtLeast(actual: UserTier, min: UserTier) {
  return TIER_RANK[actual] >= TIER_RANK[min];
}
