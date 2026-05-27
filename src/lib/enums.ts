// String literal unions mirroring the Prisma enums.
//
// Why this file exists: SQLite (used for local dev) doesn't support DB-level enums,
// so the Prisma schema stores these as `String`. We keep type-safety in the app
// layer with these unions. Validation happens in Zod schemas at API boundaries.
//
// To switch back to Postgres in production:
//   1. Change schema.prisma `provider` to "postgresql"
//   2. Re-add enum blocks (definitions kept here as the source of truth)
//   3. Change field types from `String` back to the enum names
//   4. Run a migration
// The runtime values match exactly so no app code needs to change.

export const UserTier = {
  GUEST: "GUEST",
  UNVERIFIED: "UNVERIFIED",
  VERIFIED: "VERIFIED",
  TRUSTED: "TRUSTED",
  ADMIN: "ADMIN",
} as const;
export type UserTier = (typeof UserTier)[keyof typeof UserTier];

export const UserStatus = {
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  DELETED: "DELETED",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const AppStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type AppStatus = (typeof AppStatus)[keyof typeof AppStatus];

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
export type ContactKind = (typeof ContactKind)[keyof typeof ContactKind];

export const Visibility = {
  PUBLIC: "PUBLIC",
  VERIFIED: "VERIFIED",
  TRUSTED: "TRUSTED",
  HIDDEN_REQUEST: "HIDDEN_REQUEST",
} as const;
export type Visibility = (typeof Visibility)[keyof typeof Visibility];

export const ContactReqStatus = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  DECLINED: "DECLINED",
} as const;
export type ContactReqStatus = (typeof ContactReqStatus)[keyof typeof ContactReqStatus];

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
export type EventCategory = (typeof EventCategory)[keyof typeof EventCategory];

export const EventFormat = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  HYBRID: "HYBRID",
} as const;
export type EventFormat = (typeof EventFormat)[keyof typeof EventFormat];

export const EventStatus = {
  DRAFT: "DRAFT",
  PUBLISHED: "PUBLISHED",
  CANCELLED: "CANCELLED",
  FINISHED: "FINISHED",
} as const;
export type EventStatus = (typeof EventStatus)[keyof typeof EventStatus];

export const RegStatus = {
  PENDING: "PENDING",
  CONFIRMED: "CONFIRMED",
  WAITLIST: "WAITLIST",
  DECLINED: "DECLINED",
  CANCELLED: "CANCELLED",
  CHECKED_IN: "CHECKED_IN",
  NO_SHOW: "NO_SHOW",
} as const;
export type RegStatus = (typeof RegStatus)[keyof typeof RegStatus];

export const ReportStatus = {
  OPEN: "OPEN",
  INVESTIGATING: "INVESTIGATING",
  RESOLVED: "RESOLVED",
  DISMISSED: "DISMISSED",
} as const;
export type ReportStatus = (typeof ReportStatus)[keyof typeof ReportStatus];

export const ReportTarget = {
  USER: "USER",
  EVENT: "EVENT",
  COMMENT: "COMMENT",
  POST: "POST",
} as const;
export type ReportTarget = (typeof ReportTarget)[keyof typeof ReportTarget];

// ============================================================
// 帖子分类（提问求助 / 线下交友 / 医疗信息 / 资源分享 / 感悟）
// ============================================================

export const PostSection = {
  POST: "POST",
  QUESTION: "QUESTION",
  OFFLINE_MEETUP: "OFFLINE_MEETUP",
  MEDICAL: "MEDICAL",
  RESOURCE: "RESOURCE",
  REFLECTION: "REFLECTION",
} as const;
export type PostSection = (typeof PostSection)[keyof typeof PostSection];

export const POST_SECTION_LABEL: Record<PostSection, string> = {
  POST: "提问求助",
  QUESTION: "提问求助",
  OFFLINE_MEETUP: "线下交友",
  MEDICAL: "医疗信息",
  RESOURCE: "资源分享",
  REFLECTION: "感悟",
};

export const PostStatus = {
  PENDING_REVIEW: "PENDING_REVIEW",
  PUBLISHED: "PUBLISHED",
  REJECTED: "REJECTED",
  HIDDEN: "HIDDEN",
} as const;
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

export const POST_STATUS_LABEL: Record<PostStatus, string> = {
  PENDING_REVIEW: "等待人工复核",
  PUBLISHED: "已发布",
  REJECTED: "已拒绝",
  HIDDEN: "已隐藏",
};

export const ResourceKind = {
  OFFER: "OFFER",
  REQUEST: "REQUEST",
} as const;
export type ResourceKind = (typeof ResourceKind)[keyof typeof ResourceKind];

export const RESOURCE_KIND_LABEL: Record<ResourceKind, string> = {
  OFFER: "我可以提供",
  REQUEST: "我想求助",
};
