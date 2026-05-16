import { z } from "zod";

// Posts: section + tags + hospital/doctor/city/resourceKind are all derived
// by the LLM after the user submits. Users only fill title/body/visibility.
// Validators here are the bare minimum to gate obvious-garbage inputs.

export const postVisibilityEnum = z.enum(["PUBLIC", "VERIFIED", "TRUSTED"]);

export const postInputSchema = z.object({
  title: z.string().min(2, "标题至少 2 字").max(200),
  body: z.string().min(5, "正文太短了").max(20000),
  visibility: postVisibilityEnum.default("VERIFIED"),
});

export type PostInput = z.infer<typeof postInputSchema>;

export const postCommentSchema = z.object({
  postId: z.string().min(1),
  parentId: z.string().optional().nullable(),
  body: z.string().min(1, "评论不能为空").max(4000),
});
