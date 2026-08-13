import { z } from "zod";

export const feedSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  interestProfile: z.string(),
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
