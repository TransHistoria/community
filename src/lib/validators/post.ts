import { z } from "zod";

export const postSectionEnum = z.enum(["POST", "MEDICAL", "RESOURCE"]);
export const postVisibilityEnum = z.enum(["PUBLIC", "VERIFIED", "TRUSTED"]);
export const resourceKindEnum = z.enum(["OFFER", "REQUEST"]);

export const postInputSchema = z
  .object({
    section: postSectionEnum,
    title: z.string().min(2, "标题至少 2 字").max(200),
    body: z.string().min(5, "正文太短了").max(20000),
    tags: z.array(z.string().min(1).max(30)).max(10).optional().default([]),
    hospital: z.string().max(80).optional().or(z.literal("")),
    doctor: z.string().max(60).optional().or(z.literal("")),
    city: z.string().max(40).optional().or(z.literal("")),
    resourceKind: resourceKindEnum.optional(),
    coverUrl: z.string().url().optional().or(z.literal("")),
    visibility: postVisibilityEnum.default("VERIFIED"),
  })
  .refine(
    (d) => {
      if (d.section !== "MEDICAL") return true;
      // Medical posts should at least name a hospital so they're searchable.
      return !!(d.hospital && d.hospital.trim().length > 0);
    },
    { message: "医疗信息板块需要填写医院/机构", path: ["hospital"] },
  )
  .refine(
    (d) => {
      if (d.section !== "RESOURCE") return true;
      return !!d.resourceKind;
    },
    { message: "资源板块需要选择是『提供』还是『求助』", path: ["resourceKind"] },
  );

export type PostInput = z.infer<typeof postInputSchema>;

export const postCommentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  body: z.string().min(1, "评论不能为空").max(4000),
});
