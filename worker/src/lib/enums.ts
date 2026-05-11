// Shared enums — mirrors src/lib/enums.ts in the frontend.

export const UserTier = {
  GUEST: "GUEST",
  UNVERIFIED: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  TRUSTED: "TRUSTED",
  ADMIN: "ADMIN",
} as const;
export type UserTier = (typeof UserTier)[keyof typeof UserTier];

export const TIER_RANK: Record<string, number> = {
  GUEST: 0,
  UNVERIFIED: 1,
  VERIFIED: 2,
  TRUSTED: 3,
  ADMIN: 4,
};

export function tierAtLeast(actual: string, min: string): boolean {
  return (TIER_RANK[actual] ?? 0) >= (TIER_RANK[min] ?? 0);
}

export const UserStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DELETED: "DELETED",
} as const;

export const AppStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;

export const ContactKind = {
  WECHAT: "WECHAT",
  TELEGRAM: "TELEGRAM",
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  QQ: "QQ",
  XHS: "XHS",
  WEIBO: "WEIBO",
  DISCORD: "DISCORD",
  OTHER: "OTHER",
} as const;

export const Visibility = {
  PUBLIC: "PUBLIC",
  VERIFIED: "VERIFIED",
  TRUSTED: "TRUSTED",
  HIDDEN_REQUEST: "HIDDEN_REQUEST",
} as const;

export const EventCategory = {
  PSYCH_SUPPORT: "PSYCH_SUPPORT",
  SOCIAL: "SOCIAL",
  SPORTS: "SPORTS",
  ONLINE_GAMING: "ONLINE_GAMING",
  STUDY: "STUDY",
  WORKSHOP: "WORKSHOP",
  ADVOCACY: "ADVOCACY",
  OTHER: "OTHER",
} as const;

export const EventFormat = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  HYBRID: "HYBRID",
} as const;

export const EventStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  CANCELLED: "CANCELLED",
  FINISHED: "FINISHED",
} as const;

export const RegStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  WAITLIST: "WAITLIST",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
  CHECKED_IN: "CHECKED_IN",
  NO_SHOW: "NO_SHOW",
} as const;
