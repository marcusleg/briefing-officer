import { z } from "zod";

export const feedSchema = z.object({
  title: z.string(),
  link: z.string().url(),
});
export type FeedSchema = z.infer<typeof feedSchema>;
