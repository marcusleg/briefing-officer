-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ArticleAiSummary" (
    "articleId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "summary" TEXT,
    "lead" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArticleAiSummary_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ArticleAiSummary" ("articleId", "createdAt", "summary", "updatedAt") SELECT "articleId", "createdAt", "summary", "updatedAt" FROM "ArticleAiSummary";
DROP TABLE "ArticleAiSummary";
ALTER TABLE "new_ArticleAiSummary" RENAME TO "ArticleAiSummary";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
