import { z } from "zod";

export const userSearchSchema = z.object({
  q: z.string().min(1).max(40),
});

export const shareToUserSchema = z.object({
  eventId: z.string().min(1),
  recipientId: z.string().min(1),
});

export const shareToManySchema = z.object({
  eventId: z.string().min(1),
  recipientIds: z.array(z.string().min(1)).min(1).max(10),
});
