# Update Screenshots Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `npm run update-screenshots` — a fully automated script that
reseeds the dev database and captures 4 README screenshots (mobile/desktop ×
light/dark).

**Architecture:** A Prisma seed script wipes and repopulates the dev SQLite
database. A Playwright spec handles authentication and screenshot capture. A
separate `playwright.screenshots.config.ts` wires up the dev server via
`webServer` so the whole workflow runs with one command.

**Tech Stack:** Prisma (`prisma db seed`), better-auth (`hashPassword` from
`better-auth/dist/crypto`), Playwright (`@playwright/test`), Next.js dev server.

## Global Constraints

- Seed user email: `user@example.com`, password: `password`
- Screenshot output:
  `docs/screenshots/{mobile-light,mobile-dark,desktop-light,desktop-dark}.png`
- Mobile viewport: 390×844. Desktop viewport: 1440×900.
- Seed categories: **Tech** (5 feeds), **Business** (2 feeds)
- Articles per feed: 0–8, pseudo-latin titles/descriptions, publication dates
  spread over last 30 days
- Dev database: `data/database.sqlite` (path set via
  `DATABASE_URL=file:../data/database.sqlite`)
- Do not modify `playwright.config.ts`

---

## File Map

| File                               | Action | Responsibility                                    |
| ---------------------------------- | ------ | ------------------------------------------------- |
| `prisma/seed.ts`                   | Create | Wipe DB, create user + fixtures                   |
| `playwright.screenshots.config.ts` | Create | Playwright config with `webServer` for dev server |
| `scripts/screenshots.spec.ts`      | Create | Auth + screenshot capture                         |
| `package.json`                     | Modify | Add `prisma.seed`, `update-screenshots` script    |
| `docs/screenshots/`                | Create | Output directory for PNG files                    |

---

## Task 1: Prisma seed script

**Files:**

- Create: `prisma/seed.ts`
- Modify: `package.json`

**Interfaces:**

- Produces: populated `data/database.sqlite` with user `user@example.com` /
  `password`, 2 categories, 7 feeds, 0–8 articles per feed

- [ ] **Step 1: Create `prisma/seed.ts`**

```typescript
import { hashPassword } from "better-auth/dist/crypto";
import { PrismaClient } from "@prisma/client";
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

function loremDescription(): string {
  return loremWords(12 + Math.floor(Math.random() * 20)) + ".";
}

function randomDateInLastNDays(days: number): Date {
  const now = Date.now();
  const offset = Math.floor(Math.random() * days * 24 * 60 * 60 * 1000);
  return new Date(now - offset);
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
      await prisma.article.create({
        data: {
          userId,
          feedId: feed.id,
          title: loremTitle(),
          description: loremDescription(),
          link: `https://example.com/article/${randomUUID()}`,
          publicationDate: randomDateInLastNDays(30),
        },
      });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
```

- [ ] **Step 2: Register seed script in `package.json`**

Add after the `"scripts"` block (at the top level, alongside `"dependencies"`):

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
},
```

Also confirm `tsx` is already a dev dependency — it is (`"tsx": "4.22.4"`).

- [ ] **Step 3: Run the seed script to verify it works**

```bash
DATABASE_URL=file:../data/database.sqlite npx prisma db seed
```

Expected output:

```
Running seed command `tsx prisma/seed.ts` ...
Seed complete.

🌱  The seed command has been executed.
```

If you see a type error about `hashPassword`, check the import path:
`import { hashPassword } from "better-auth/dist/crypto";`

- [ ] **Step 4: Verify the database contains expected data**

```bash
DATABASE_URL=file:../data/database.sqlite npx prisma studio
```

Check in the browser that `user`, `account`, `feedCategory`, `feed`, and
`article` tables have rows. Then close Prisma Studio.

- [ ] **Step 5: Commit**

```bash
git add prisma/seed.ts package.json
git commit -m "feat: add prisma seed script with demo fixtures"
```

---

## Task 2: Playwright screenshots config

**Files:**

- Create: `playwright.screenshots.config.ts`

**Interfaces:**

- Consumes: `npm run dev` (Next.js on port 3000), `scripts/screenshots.spec.ts`
- Produces: Playwright config that starts the dev server automatically and runs
  only `scripts/`

- [ ] **Step 1: Create `playwright.screenshots.config.ts`**

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    env: {
      DATABASE_URL: "file:../data/database.sqlite",
    },
    url: "http://localhost:3000",
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 2: Verify the config is valid TypeScript**

```bash
npx tsc --noEmit playwright.screenshots.config.ts
```

Expected: no output (no errors). If you see errors about missing types, check
that `@playwright/test` is in `devDependencies` — it is
(`"@playwright/test": "^1.60.0"`).

- [ ] **Step 3: Commit**

```bash
git add playwright.screenshots.config.ts
git commit -m "feat: add playwright config for screenshot capture"
```

---

## Task 3: Screenshot spec and npm script

**Files:**

- Create: `scripts/screenshots.spec.ts`
- Create: `docs/screenshots/.gitkeep`
- Modify: `package.json`

**Interfaces:**

- Consumes: seed user `user@example.com` / `password`, `http://localhost:3000`
- Produces:
  `docs/screenshots/{mobile-light,mobile-dark,desktop-light,desktop-dark}.png`

- [ ] **Step 1: Create `docs/screenshots/` and add a `.gitkeep`**

```bash
mkdir -p docs/screenshots
touch docs/screenshots/.gitkeep
```

- [ ] **Step 2: Create `scripts/screenshots.spec.ts`**

```typescript
import { request, test } from "@playwright/test";
import path from "path";

const SCREENSHOTS_DIR = path.resolve(__dirname, "../docs/screenshots");
const BASE_URL = "http://localhost:3000";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

const THEMES = ["light", "dark"] as const;

test("capture screenshots", async ({ browser }) => {
  // Authenticate and save storage state
  const apiContext = await request.newContext({ baseURL: BASE_URL });
  await apiContext.post("/api/auth/sign-in/email", {
    data: { email: "user@example.com", password: "password" },
  });
  const storageState = await apiContext.storageState();
  await apiContext.dispose();

  // Capture one screenshot per viewport × theme combination
  for (const viewport of VIEWPORTS) {
    for (const theme of THEMES) {
      const context = await browser.newContext({
        storageState,
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: theme,
      });
      const page = await context.newPage();

      await page.goto("/feed");
      await page.waitForLoadState("networkidle");

      // Force theme class to match colorScheme
      if (theme === "dark") {
        await page.evaluate(() =>
          document.documentElement.classList.add("dark"),
        );
      } else {
        await page.evaluate(() =>
          document.documentElement.classList.remove("dark"),
        );
      }

      const filename = `${viewport.name}-${theme}.png`;
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, filename),
        fullPage: false,
      });

      await context.close();
      console.log(`Saved: docs/screenshots/${filename}`);
    }
  }
});
```

- [ ] **Step 3: Add `update-screenshots` to `package.json` scripts**

In the `"scripts"` block, add:

```json
"update-screenshots": "prisma db seed && playwright test --config=playwright.screenshots.config.ts"
```

- [ ] **Step 4: Run `npm run update-screenshots` and verify**

```bash
npm run update-screenshots
```

Expected:

- Seed output: `Seed complete.`
- Playwright starts the dev server, logs the test running
- 4 PNG files appear in `docs/screenshots/`

Verify the files exist:

```bash
ls -lh docs/screenshots/*.png
```

Expected: 4 files, each a few hundred KB.

Open one to visually confirm it looks correct:

```bash
xdg-open docs/screenshots/desktop-light.png
```

- [ ] **Step 5: Commit**

```bash
git add scripts/screenshots.spec.ts playwright.screenshots.config.ts docs/screenshots/.gitkeep package.json
git commit -m "feat: add screenshot capture script and npm run update-screenshots"
```

---

## Self-Review

**Spec coverage:**

- ✅ Wipe DB and reseed — Task 1
- ✅ Example user with login — Task 1
- ✅ 2 categories (Tech, Business) — Task 1
- ✅ 5 feeds in Tech (Hacker News, CNCF Blog, Fedora Magazine, Phoronix,
  codecentric AG Blog), 2 in Business (Financial Times Deutschland, Tagesschau -
  Wirtschaft) with real RSS URLs — Task 1
- ✅ 0–8 articles per feed, pseudo-latin, dates spread over 30 days — Task 1
- ✅ Playwright `webServer` starts dev server — Task 2
- ✅ Auth via API sign-in + storageState (same pattern as
  `tests/e2e/fixtures.ts`) — Task 3
- ✅ 4 screenshots: mobile/desktop × light/dark — Task 3
- ✅ Output to `docs/screenshots/` — Task 3
- ✅ `npm run update-screenshots` — Task 3
- ✅ `prisma.seed` registered in `package.json` — Task 1
- ✅ Existing `playwright.config.ts` untouched — Task 2

**Placeholder scan:** None found.

**Type consistency:** `hashPassword(password: string): Promise<string>` used in
Task 1. `storageState` object from `apiContext.storageState()` passed directly
to `browser.newContext()` — matches Playwright's accepted type.
