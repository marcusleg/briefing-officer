-- CreateTable
CREATE TABLE "FeedFilter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "feedId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FeedFilter_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedFilter_feedId_kind_text_key" ON "FeedFilter"("feedId", "kind", "text");
