-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "publicationDate" DATETIME NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "link" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "feedId" INTEGER NOT NULL,
    CONSTRAINT "Article_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Article" ("content", "createdAt", "description", "feedId", "id", "link", "publicationDate", "read", "title", "updatedAt") SELECT "content", "createdAt", "description", "feedId", "id", "link", "publicationDate", "read", "title", "updatedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_link_key" ON "Article"("link");
CREATE TABLE "new_ArticleAiSummary" (
    "articleId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "summary" TEXT,
    "lead" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArticleAiSummary_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ArticleAiSummary" ("articleId", "createdAt", "lead", "summary", "updatedAt") SELECT "articleId", "createdAt", "lead", "summary", "updatedAt" FROM "ArticleAiSummary";
DROP TABLE "ArticleAiSummary";
ALTER TABLE "new_ArticleAiSummary" RENAME TO "ArticleAiSummary";
CREATE TABLE "new_ArticleReadability" (
    "articleId" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "content" TEXT NOT NULL,
    "textContent" TEXT NOT NULL,
    "byLine" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArticleReadability_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ArticleReadability" ("articleId", "byLine", "content", "createdAt", "textContent", "updatedAt") SELECT "articleId", "byLine", "content", "createdAt", "textContent", "updatedAt" FROM "ArticleReadability";
DROP TABLE "ArticleReadability";
ALTER TABLE "new_ArticleReadability" RENAME TO "ArticleReadability";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
