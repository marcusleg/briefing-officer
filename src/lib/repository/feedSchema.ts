import { z } from "zod";

export const feedSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  titleFilterExpressions: z.string(),
});
export type FeedSchema = z.infer<typeof feedSchema>;
