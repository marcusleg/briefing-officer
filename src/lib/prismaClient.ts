import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import logger from "./logger";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

// SQLite's default journal mode blocks readers for the duration of every
// write transaction, so a feed refresh can stall the whole site. Enable
// Write-Ahead Logging so reads can proceed concurrently with writes.
//
// journal_mode is persisted in the database file itself, so setting it once
// here is enough for the lifetime of the file. busy_timeout is per
// connection rather than persisted, but this module creates the single
// PrismaClient used for the whole process, so applying it here covers every
// query made through it. Both pragmas return a result row in SQLite, so
// $queryRawUnsafe (not $executeRawUnsafe) is required for both.
//
// These are awaited at the top level (rather than fired-and-forgotten) so
// that every other module, which can only reach `prisma` by importing this
// one, is guaranteed to wait for the pragmas to take effect first. Without
// that barrier, a query issued in the same tick as module initialization can
// race ahead of the WAL switch and run against the pre-WAL connection.
try {
  await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;");
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
} catch (error) {
  logger.error({ err: error }, "Failed to configure SQLite pragmas");
}

export default prisma;
