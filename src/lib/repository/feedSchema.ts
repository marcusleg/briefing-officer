import { z } from "zod";

export const feedSchema = z.object({
  title: z.string(),
  link: z.string().url(),
  titleFilterExpressions: z
    .string()
    // .transform((line) => line.split("\n"))
    .refine(
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
});
export type FeedSchema = z.infer<typeof feedSchema>;
