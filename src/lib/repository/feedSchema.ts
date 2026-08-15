import { z } from "zod";

export const feedSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  interests: z.array(z.string().trim().min(1)).default([]),
  disinterests: z.array(z.string().trim().min(1)).default([]),
  feedCategoryId: z.number().optional(),
  autoRefresh: z.boolean(),
});
export type FeedSchema = z.infer<typeof feedSchema>;

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
});
export type CategorySchema = z.infer<typeof categorySchema>;
