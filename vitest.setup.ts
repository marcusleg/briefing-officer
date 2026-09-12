import { execSync } from "child_process";
import { mkdirSync } from "fs";
import { resolve } from "path";
import { afterEach, beforeAll, beforeEach, vi } from "vitest";

// 1. Point Prisma at a per-worker, absolute SQLite file BEFORE any module
//    imports the Prisma singleton (it reads DATABASE_URL at construction).
const workerId = process.env.VITEST_WORKER_ID ?? "0";
const tmpDir = resolve(process.cwd(), ".tmp");
mkdirSync(tmpDir, { recursive: true });
const dbPath = resolve(tmpDir, `test-${workerId}.db`);
process.env.DATABASE_URL = `file:${dbPath}`;

// 1b. The schema push in step 3 is a data-loss command, which the Prisma CLI
//     refuses to run for an AI agent without recorded consent. The consent is
//     safe to record here and nowhere else: DATABASE_URL was just repointed at
//     a throwaway per-worker file under the git-ignored .tmp/, so the push can
//     only ever destroy a database this file created. Never widen this to a
//     shell profile or .env, where it would also cover the real database.
process.env.PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION =
  "You can set PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION. The database we have locally is not important.";

// 2. Always-on global mocks for Next.js runtime + logger.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  // The real redirect throws a special error to halt rendering; tests that
  // assert redirect behavior can spy on this mock instead.
  redirect: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// 3. Apply the Prisma schema to this worker's database exactly once.
//    On failure, execSync throws and the captured output is re-surfaced so the
//    error is a clear "schema push failed", not a downstream "no such table".
beforeAll(() => {
  try {
    execSync("npx prisma db push --accept-data-loss", {
      env: process.env,
      stdio: "pipe",
    });
  } catch (error) {
    const err = error as { stdout?: Buffer; stderr?: Buffer };
    const output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    throw new Error(`prisma db push failed:\n${output}`);
  }
});

// 4. Start every test from a clean database.
//    The import is dynamic on purpose: a static top-level import would be
//    hoisted and load the prisma singleton before DATABASE_URL is set above.
beforeEach(async () => {
  const { resetDb } = await import("./tests/helpers/db");
  await resetDb();
});

afterEach(() => {
  vi.clearAllMocks();
});
