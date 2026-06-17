import { PrismaClient } from "@prisma/client";
import { hashPassword } from "better-auth/crypto";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

const LOREM_WORDS = [
  "lorem",
  "ipsum",
  "dolor",
  "sit",
  "amet",
  "consectetur",
  "adipiscing",
  "elit",
  "sed",
  "do",
  "eiusmod",
  "tempor",
  "incididunt",
  "ut",
  "labore",
  "et",
  "dolore",
  "magna",
  "aliqua",
  "enim",
  "ad",
  "minim",
  "veniam",
  "quis",
  "nostrud",
  "exercitation",
  "ullamco",
  "laboris",
  "nisi",
  "aliquip",
  "ex",
  "ea",
  "commodo",
  "consequat",
  "duis",
  "aute",
  "irure",
  "reprehenderit",
  "voluptate",
  "velit",
  "esse",
  "cillum",
  "fugiat",
  "nulla",
  "pariatur",
];

const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Carol",
  "David",
  "Eve",
  "Frank",
  "Grace",
  "Henry",
  "Isabel",
  "James",
  "Karen",
  "Liam",
  "Mia",
  "Noah",
  "Olivia",
  "Paul",
  "Quinn",
  "Rachel",
  "Sam",
  "Tara",
];
const LAST_NAMES = [
  "Anderson",
  "Brown",
  "Chen",
  "Davis",
  "Evans",
  "Fischer",
  "Garcia",
  "Harris",
  "Imai",
  "Jones",
  "Kim",
  "Lopez",
  "Miller",
  "Nguyen",
  "Ortiz",
  "Patel",
  "Quinn",
  "Roberts",
  "Smith",
  "Taylor",
];

function randomName(): string {
  return (
    FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] +
    " " +
    LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
  );
}

function loremWords(n: number): string {
  return Array.from(
    { length: n },
    () => LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)],
  ).join(" ");
}

function loremTitle(): string {
  const title = loremWords(4 + Math.floor(Math.random() * 5));
  return title.charAt(0).toUpperCase() + title.slice(1);
}

function lorem(n: number): string {
  const words = loremWords(n);
  return words.charAt(0).toUpperCase() + words.slice(1) + ".";
}

function randomDateInLastNDays(days: number): Date {
  const now = Date.now();
  const offset = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now - offset);
}

function isoDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

async function main() {
  // Wipe in FK-safe order
  await prisma.articleScrape.deleteMany();
  await prisma.articleLead.deleteMany();
  await prisma.article.deleteMany();
  await prisma.feed.deleteMany();
  await prisma.feedCategory.deleteMany();
  await prisma.tokenUsage.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verification.deleteMany();
  await prisma.user.deleteMany();

  // Create user
  const userId = randomUUID();
  const email = "user@example.com";
  const password = "password";
  const hashedPassword = await hashPassword(password);

  await prisma.user.create({
    data: {
      id: userId,
      name: "Demo User",
      email,
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: email,
      providerId: "credential",
      userId,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  // Categories
  const tech = await prisma.feedCategory.create({
    data: { userId, name: "Tech" },
  });
  const business = await prisma.feedCategory.create({
    data: { userId, name: "Business" },
  });

  // Feeds: 5 in Tech, 2 in Business
  const feedDefs = [
    {
      title: "Hacker News",
      link: "https://hnrss.org/newest?points=500",
      categoryId: tech.id,
    },
    {
      title: "CNCF Blog",
      link: "https://www.cncf.io/blog/atom",
      categoryId: tech.id,
    },
    {
      title: "Fedora Magazine",
      link: "https://fedoramagazine.org/feed/",
      categoryId: tech.id,
    },
    {
      title: "Phoronix",
      link: "https://www.phoronix.com/rss.php",
      categoryId: tech.id,
    },
    {
      title: "codecentric AG Blog",
      link: "https://www.codecentric.de/rss/feed.xml",
      categoryId: tech.id,
    },
    {
      title: "Financial Times Deutschland",
      link: "https://www.ftd.de/feed/",
      categoryId: business.id,
    },
    {
      title: "Tagesschau - Wirtschaft",
      link: "https://www.tagesschau.de/wirtschaft/index~rss2.xml",
      categoryId: business.id,
    },
  ];

  for (const def of feedDefs) {
    const feed = await prisma.feed.create({
      data: {
        userId,
        title: def.title,
        link: def.link,
        lastFetched: new Date(),
        feedCategoryId: def.categoryId,
      },
    });

    const articleCount = Math.floor(Math.random() * 9); // 0–8
    for (let i = 0; i < articleCount; i++) {
      const article = await prisma.article.create({
        data: {
          userId,
          feedId: feed.id,
          title: loremTitle(),
          description: lorem(50 + Math.floor(Math.random() * 11)),
          link: `https://example.com/article/${randomUUID()}`,
          publicationDate: randomDateInLastNDays(30),
        },
      });
      const textContent = lorem(300 + Math.floor(Math.random() * 1201));
      await prisma.articleScrape.create({
        data: { articleId: article.id, textContent, author: randomName() },
      });
      await prisma.articleLead.create({
        data: {
          articleId: article.id,
          text: lorem(50 + Math.floor(Math.random() * 11)),
        },
      });
    }

    // 5–10 already-read articles per feed within the last 7 days (for Daily Activity chart)
    const readCount = 5 + Math.floor(Math.random() * 6);
    for (let i = 0; i < readCount; i++) {
      const readAt = randomDateInLastNDays(7);
      const article = await prisma.article.create({
        data: {
          userId,
          feedId: feed.id,
          title: loremTitle(),
          description: lorem(50 + Math.floor(Math.random() * 11)),
          link: `https://example.com/article/${randomUUID()}`,
          publicationDate: new Date(readAt.getTime() - 3600_000),
          readAt,
        },
      });
      const textContent = lorem(300 + Math.floor(Math.random() * 1201));
      await prisma.articleScrape.create({
        data: { articleId: article.id, textContent, author: randomName() },
      });
      await prisma.articleLead.create({
        data: {
          articleId: article.id,
          text: lorem(50 + Math.floor(Math.random() * 11)),
        },
      });
    }
  }

  // Token usage: 1–3 entries per day for the last 7 days
  const MODEL = "claude-sonnet-4-6";
  for (let d = 0; d < 7; d++) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const dateStr = isoDate(date);
    await prisma.tokenUsage.create({
      data: {
        userId,
        date: dateStr,
        model: MODEL,
        inputTokens: 1000 + Math.floor(Math.random() * 9000),
        outputTokens: 200 + Math.floor(Math.random() * 1800),
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
