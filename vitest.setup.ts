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
