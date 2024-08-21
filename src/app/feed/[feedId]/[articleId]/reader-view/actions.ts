import prisma from "@/lib/prismaClient";
import { Readability } from "@mozilla/readability";
import axios from "axios";
import DOMPurify from "isomorphic-dompurify";
import { JSDOM } from "jsdom";

export const getReadability = async (
  articleId: number,
  articleLink: string,
) => {
  const readability = await prisma.articleReadability.findUnique({
    where: { articleId: articleId },
  });

  if (readability) {
    return readability;
  }

  const website = await axios.get(articleLink);
  const cleanBody = DOMPurify.sanitize(website.data);
  const document = new JSDOM(cleanBody);
  const parsedArticle = new Readability(document.window.document).parse();

  if (!parsedArticle) {
    throw new Error("Failed to parse article");
  }

  return prisma.articleReadability.create({
    data: {
      articleId: articleId,
      content: parsedArticle.content,
      textContent: parsedArticle.textContent,
      byLine: parsedArticle.byline,
    },
  });
};
