-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Feed" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "lastFetched" DATETIME NOT NULL,
    "titleFilterExpressions" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    "feedCategoryId" INTEGER,
    CONSTRAINT "Feed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Feed_feedCategoryId_fkey" FOREIGN KEY ("feedCategoryId") REFERENCES "FeedCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Feed" ("createdAt", "feedCategoryId", "id", "lastFetched", "link", "title", "titleFilterExpressions", "updatedAt", "userId") SELECT "createdAt", "feedCategoryId", "id", "lastFetched", "link", "title", "titleFilterExpressions", "updatedAt", "userId" FROM "Feed";
DROP TABLE "Feed";
ALTER TABLE "new_Feed" RENAME TO "Feed";
CREATE UNIQUE INDEX "Feed_userId_link_key" ON "Feed"("userId", "link");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
