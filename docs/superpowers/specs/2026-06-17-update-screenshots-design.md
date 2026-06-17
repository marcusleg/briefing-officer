# Design: `update-screenshots` script

**Date:** 2026-06-17

## Goal

Provide a repeatable way to refresh the README screenshots. Running
`npm run update-screenshots` resets the local SQLite database to a known fixture
state, starts the app, and captures 4 screenshots (mobile/desktop × light/dark)
into `docs/screenshots/`.

## Components

### `prisma/seed.ts`

A Prisma-native seed script, registered in `package.json` under `prisma.seed`
and run via `npx prisma db seed`.

**Responsibilities:**

1. Wipe all rows in dependency order to respect FK constraints: `ArticleScrape`,
   `ArticleLead` → `Article` → `Feed` → `FeedCategory` → `TokenUsage` →
   `Session`, `Account`, `Verification` → `User`
2. Create one user directly via Prisma with a bcrypt-hashed password, plus a
   corresponding `Account` row for better-auth's `credential` provider.
3. Create 2 `FeedCategory` rows: **Tech** and **Business**.
4. Create 7 `Feed` rows: 5 assigned to Tech, 2 to Business. Each has a plausible
   title and a fake RSS URL.
5. Create 0–8 `Article` rows per feed. Titles and descriptions are pseudo-latin.
   Publication dates are randomised across the last 30 days.

**Seed credentials:**

- Email: `user@example.com`
- Password: `password`

### `playwright.screenshots.config.ts`

A separate Playwright config used only for screenshot capture. Key differences
from `playwright.config.ts`:

- `webServer` always enabled, pointing at `npm run dev` with the real
  `data/database.sqlite` and `reuseExistingServer: true`.
- Single project: `chromium` only (no need for cross-browser coverage).
- `testDir` pointing at `scripts/` so it doesn't pick up `tests/e2e/`.

### `scripts/screenshots.spec.ts`

A Playwright spec file (not a test suite — a script) that handles authentication
and captures the 4 screenshots. It follows the same auth pattern as
`tests/e2e/fixtures.ts`:

1. Sign in via `POST /api/auth/sign-in/email` using the seed credentials.
2. Save the resulting cookies/storage to a temp file via `storageState`.
3. Open 4 browser contexts (or sequentially reuse one), each loading the saved
   storage state so the page is already authenticated.
4. For each screenshot: set the viewport, force the theme class on
   `document.documentElement`, navigate to `/feed`, wait for the page to settle,
   then call `page.screenshot()`.

Output files:
`docs/screenshots/{mobile-light,mobile-dark,desktop-light,desktop-dark}.png`

### `package.json` — `update-screenshots` script

A new npm script that chains the two steps:

```
"update-screenshots": "prisma db seed && playwright test --config=playwright.screenshots.config.ts"
```

## Data flow

```
npm run update-screenshots
  │
  ├─ prisma db seed
  │     └─ prisma/seed.ts  →  data/database.sqlite (wiped + reseeded)
  │
  └─ playwright test --config=playwright.screenshots.config.ts
        ├─ webServer: npm run dev  →  Next.js on :3000 (started + stopped by Playwright)
        ├─ POST /api/auth/sign-in/email  →  storageState saved to temp file
        └─ 4× (viewport + theme + navigate /feed + screenshot → docs/screenshots/*.png)
```

## Constraints

- `data/database.sqlite` is dev-only and gitignored; wiping it is safe.
- Screenshots in `docs/screenshots/` are committed and referenced from
  `README.md`.
- The seed script is also useful standalone for resetting dev state without
  taking screenshots.
- The script is self-contained: Playwright's `webServer` starts and stops the
  dev server automatically.

## Out of scope

- Seeding data for other pages (category pages, article detail, AI summary,
  etc.).
- CI integration — this is a manual developer workflow.
