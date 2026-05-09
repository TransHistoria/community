import { z } from "zod";

export const handleSchema = z
  .string()
  .min(2, "至少 2 位")
  .max(24, "不超过 24 位")
  .regex(/^[a-z0-9_]+$/, "仅允许小写字母、数字、下划线");

export const profileSchema = z.object({
  handle: handleSchema,
  displayName: z.string().min(1, "请填写昵称").max(40, "昵称过长"),
  pronouns: z.string().max(40).optional().or(z.literal("")),
  genderIdentity: z.string().max(80).optional().or(z.literal("")),
  bio: z.string().max(2000).optional().or(z.literal("")),
});

export const contactKindEnum = z.enum([
  "WECHAT",
  "TELEGRAM",
  "EMAIL",
  "PHONE",
  "QQ",
  "XHS",
  "WEIBO",
  "DISCORD",
  "OTHER",
]);
export const visibilityEnum = z.enum([
  "PUBLIC",
  "VERIFIED",
  "TRUSTED",
  "HIDDEN_REQUEST",
]);

export const contactSchema = z.object({
  kind: contactKindEnum,
  value: z.string().min(1, "请填写联系方式").max(200),
  label: z.string().max(40).optional().or(z.literal("")),
  visibility: visibilityEnum,
});

export const contactRequestSchema = z.object({
  targetHandle: z.string(),
  contactId: z.string().optional(),
  reason: z.string().min(20, "请稍微说明理由（至少 20 字）").max(500),
});
