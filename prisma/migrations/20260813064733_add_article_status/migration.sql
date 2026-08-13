-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "publicationDate" DATETIME NOT NULL,
    "description" TEXT,
    "content" TEXT,
    "author" TEXT,
    "language" TEXT,
    "link" TEXT NOT NULL,
    "commentsLink" TEXT,
    "readAt" DATETIME,
    "readLater" BOOLEAN NOT NULL DEFAULT false,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "statusChangedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "filterReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "feedId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Article_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Article_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Article" (
    "id", "title", "publicationDate", "description", "content", "author",
    "language", "link", "commentsLink", "readAt", "readLater", "starred",
    "createdAt", "updatedAt", "feedId", "userId",
    "status", "statusChangedAt", "filterReason"
)
SELECT
    "id", "title", "publicationDate", "description", "content", "author",
    "language", "link", "commentsLink", "readAt", "readLater", "starred",
    "createdAt", "updatedAt", "feedId", "userId",
    -- readLater wins over readAt: the only way to hold both is read, then
    -- deliberately marked read-later, so READ_LATER is the latest intent.
    CASE WHEN "readLater" THEN 'READ_LATER'
         WHEN "readAt" IS NOT NULL THEN 'READ'
         ELSE 'UNREAD' END,
    CASE WHEN "readLater" THEN "updatedAt"
         WHEN "readAt" IS NOT NULL THEN "readAt"
         ELSE "createdAt" END,
    NULL
FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_userId_feedId_link_key" ON "Article"("userId", "feedId", "link");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
