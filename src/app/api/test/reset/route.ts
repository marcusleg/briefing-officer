import prisma from "@/lib/prismaClient";

const environment = process.env.NODE_ENV;

export const POST = async () => {
  if (!["development", "test"].includes(environment)) {
    return new Response("", { status: 404 });
  }

  try {
    await Promise.all([
      prisma.account.deleteMany(),
      prisma.article.deleteMany(),
      prisma.articleAiTexts.deleteMany(),
      prisma.articleScrape.deleteMany(),
      prisma.feed.deleteMany(),
      prisma.session.deleteMany(),
      prisma.user.deleteMany(),
      prisma.verification.deleteMany(),
    ]);
  } catch (error) {
    console.error(error);
    return Response.json(
      { message: "Failed to clear the database." },
      { status: 500 },
    );
  }

  return Response.json(
    { message: "Database cleared successfully." },
    { status: 200 },
  );
};
