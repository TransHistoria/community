import type { EventCategory } from "@/lib/enums";

// Indexed by string so Prisma's untyped enum fields can be passed directly.
export const CATEGORY_LABEL: Record<string, string> = {
  PSYCH_SUPPORT: "心理支持",
  SOCIAL: "聚会游玩",
  SPORTS: "运动",
  ONLINE_GAMING: "线上游戏组队",
  STUDY: "学习读书",
  WORKSHOP: "工作坊",
  ADVOCACY: "倡导/公共",
  OTHER: "其他",
};

export const FORMAT_LABEL: Record<string, string> = {
  ONLINE: "线上",
  OFFLINE: "线下",
  HYBRID: "线上 + 线下",
};

export const EVENT_VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: "公开（含未登录访客）",
  VERIFIED: "认证成员可见",
  TRUSTED: "仅信任成员可见",
  HIDDEN_REQUEST: "—",
};

export const ALL_CATEGORIES: EventCategory[] = [
  "PSYCH_SUPPORT",
  "SOCIAL",
  "SPORTS",
  "ONLINE_GAMING",
  "STUDY",
  "WORKSHOP",
  "ADVOCACY",
  "OTHER",
];
