import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  migrations: {
    // Prisma 7 reads the seed command from here; the `prisma.seed` key in
    // package.json is ignored, and `prisma db seed` exits 0 without running
    // anything when this is missing.
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Use process.env with a fallback rather than Prisma's `env()` helper,
    // which throws when the variable is unset. `prisma generate` does not
    // need a database connection, and CI runs it (e.g. before the tests)
    // without DATABASE_URL set; the throwing helper would fail that step.
    // Commands that do connect (db push, migrate deploy) still receive the
    // real URL from the environment.
    url: process.env.DATABASE_URL ?? "",
  },
});
