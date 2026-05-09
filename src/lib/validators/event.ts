import { z } from "zod";

export const eventCategoryEnum = z.enum([
  "PSYCH_SUPPORT",
  "SOCIAL",
  "SPORTS",
  "ONLINE_GAMING",
  "STUDY",
  "WORKSHOP",
  "ADVOCACY",
  "OTHER",
]);
export const eventFormatEnum = z.enum(["ONLINE", "OFFLINE", "HYBRID"]);
export const visibilityEnum = z.enum(["PUBLIC", "VERIFIED", "TRUSTED"]); // HIDDEN_REQUEST not used for events

const customQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1).max(200),
  required: z.boolean(),
  type: z.enum(["text", "long-text", "single-choice"]),
  options: z.array(z.string().min(1).max(100)).optional(),
});

export const eventInputSchema = z
  .object({
    title: z.string().min(2, "标题至少 2 字").max(120),
    description: z.string().min(10, "描述太短了").max(20000),
    category: eventCategoryEnum,
    format: eventFormatEnum,
    coverUrl: z.string().url().optional().or(z.literal("")),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    timezone: z.string().default("Asia/Shanghai"),
    city: z.string().max(40).optional().or(z.literal("")),
    preciseAddr: z.string().max(200).optional().or(z.literal("")),
    onlineUrl: z.string().url().optional().or(z.literal("")),
    capacity: z
      .union([z.number().int().min(1).max(10000), z.literal("").transform(() => undefined)])
      .optional(),
    requireApproval: z.boolean().default(false),
    registrationOpensAt: z.coerce.date().optional().nullable(),
    registrationClosesAt: z.coerce.date().optional().nullable(),
    customQuestions: z.array(customQuestionSchema).optional().default([]),
    visibility: visibilityEnum.default("VERIFIED"),
  })
  .refine((d) => d.endAt > d.startAt, {
    message: "结束时间必须晚于开始时间",
    path: ["endAt"],
  })
  .refine(
    (d) => {
      if (d.format === "OFFLINE" || d.format === "HYBRID") {
        return !!d.city && d.city.length > 0;
      }
      return true;
    },
    { message: "线下/混合活动需要填写城市", path: ["city"] },
  )
  .refine(
    (d) => {
      if (d.format === "ONLINE" || d.format === "HYBRID") {
        return !!d.onlineUrl && d.onlineUrl.length > 0;
      }
      return true;
    },
    { message: "线上/混合活动需要填写会议链接", path: ["onlineUrl"] },
  );

export type EventInput = z.infer<typeof eventInputSchema>;

export const registrationInputSchema = z.object({
  eventId: z.string().min(1),
  answers: z.record(z.string(), z.string().max(2000)).optional(),
});

export const commentSchema = z.object({
  eventId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  body: z.string().min(1).max(4000),
});
