-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feed" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "lastFetched" DATETIME NOT NULL,
    "interestProfile" TEXT NOT NULL DEFAULT '',
    "autoRefresh" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "feedCategoryId" INTEGER,
    CONSTRAINT "Feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Feed_feedCategoryId_fkey" FOREIGN KEY ("feedCategoryId") REFERENCES "FeedCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Feed" ("autoRefresh", "createdAt", "feedCategoryId", "id", "interestProfile", "lastFetched", "link", "title", "updatedAt", "userId") SELECT "autoRefresh", "createdAt", "feedCategoryId", "id",
    CASE WHEN "titleFilterExpressions" <> ''
         THEN 'Do not show articles whose titles match any of these regular expressions:'
              || char(10) || "titleFilterExpressions"
         ELSE '' END,
    "lastFetched", "link", "title", "updatedAt", "userId" FROM "Feed";
DROP TABLE "Feed";
ALTER TABLE "new_Feed" RENAME TO "Feed";
CREATE UNIQUE INDEX "Feed_userId_link_key" ON "Feed"("userId", "link");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
