import { z } from "zod";

export const emailSchema = z
  .string()
  .min(1, "请填写邮箱")
  .email("邮箱格式不正确");

export const inviteCodeSchema = z
  .string()
  .min(4, "邀请码至少 4 位")
  .max(32, "邀请码过长")
  .regex(/^[A-Za-z0-9_-]+$/, "邀请码包含非法字符");

export const signInSchema = z.object({
  email: emailSchema,
});

export const signUpInviteSchema = z.object({
  email: emailSchema,
  code: inviteCodeSchema,
});

export const applicationSchema = z.object({
  email: emailSchema,
  identity: z
    .string()
    .min(10, "请简单描述一下你的自我认同（至少 10 字）")
    .max(500),
  motivation: z
    .string()
    .min(20, "为什么想加入？请稍微展开（至少 20 字）")
    .max(1000),
  vouch: z.string().max(200).optional(),
  agreeGuidelines: z.literal(true, {
    errorMap: () => ({ message: "请确认你已阅读社区守则" }),
  }),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
