/*
  Warnings:

  - You are about to drop the column `htmlContent` on the `ArticleScrape` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArticleScrape" (
    "articleId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "textContent" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArticleScrape_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ArticleScrape" ("articleId", "author", "createdAt", "textContent", "updatedAt") SELECT "articleId", "author", "createdAt", "textContent", "updatedAt" FROM "ArticleScrape";
DROP TABLE "ArticleScrape";
ALTER TABLE "new_ArticleScrape" RENAME TO "ArticleScrape";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
