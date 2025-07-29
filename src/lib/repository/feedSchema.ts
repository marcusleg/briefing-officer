import { z } from "zod";

export const feedSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  titleFilterExpressions: z.string().refine(
    (lines) => {
      return lines.split("\n").every((line) => {
        try {
          new RegExp(line);
          return true;
        } catch (e) {
          return false;
        }
      });
    },
    {
      message:
        "All title filter expressions must be valid regular expressions.",
    },
  ),
  feedCategoryId: z.number().optional(),
});
export type FeedSchema = z.infer<typeof feedSchema>;

export const categorySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters"),
});
export type CategorySchema = z.infer<typeof categorySchema>;
