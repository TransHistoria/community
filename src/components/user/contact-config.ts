// Indexed by string so Prisma's untyped enum fields can be passed directly.
export const CONTACT_KIND_LABEL: Record<string, string> = {
  WECHAT: "微信",
  TELEGRAM: "Telegram",
  EMAIL: "邮箱",
  PHONE: "手机号",
  QQ: "QQ",
  XHS: "小红书",
  WEIBO: "微博",
  DISCORD: "Discord",
  OTHER: "其他",
};

export const VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: "公开（所有人）",
  VERIFIED: "认证成员可见",
  TRUSTED: "信任成员可见",
  HIDDEN_REQUEST: "隐藏（需申请查看）",
};

export const VISIBILITY_SHORT: Record<string, string> = {
  PUBLIC: "公开",
  VERIFIED: "认证可见",
  TRUSTED: "信任可见",
  HIDDEN_REQUEST: "需申请",
};
