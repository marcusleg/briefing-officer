-- Starred articles are now called archived; the rename keeps every value.
ALTER TABLE "Article" RENAME COLUMN "starred" TO "archived";
