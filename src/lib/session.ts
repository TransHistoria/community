import type { UserTier } from "@/lib/enums";

export type SessionUser = {
  id: string;
  email?: string | null;
  handle: string;
  displayName: string;
  tier: UserTier;
  avatarUrl?: string | null;
};

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
