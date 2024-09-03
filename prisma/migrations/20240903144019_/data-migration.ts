import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const articles = await tx.article.findMany();
    for (const article of articles) {
      await tx.article.update({
        where: { id: article.id },
        data: {
          readAt: article.read ? new Date(0) : null,
        },
      });
    }
  });
}

main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
