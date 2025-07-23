/*
  Warnings:

  - You are about to drop the column `summary` on the `ArticleAiTexts` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArticleAiTexts" (
    "articleId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lead" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArticleAiTexts_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ArticleAiTexts" ("articleId", "createdAt", "lead", "updatedAt") SELECT "articleId", "createdAt", "lead", "updatedAt" FROM "ArticleAiTexts";
DROP TABLE "ArticleAiTexts";
ALTER TABLE "new_ArticleAiTexts" RENAME TO "ArticleAiTexts";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
