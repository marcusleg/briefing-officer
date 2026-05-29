import prisma from "@/lib/prismaClient";

/**
 * Clears every table in foreign-key-safe order (children before parents).
 * Using prisma.deleteMany avoids depending on physical table names.
 */
export const resetDb = async () => {
  await prisma.articleLead.deleteMany();
  await prisma.articleScrape.deleteMany();
  await prisma.tokenUsage.deleteMany();
  await prisma.article.deleteMany();
  await prisma.feed.deleteMany();
  await prisma.feedCategory.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();
};
