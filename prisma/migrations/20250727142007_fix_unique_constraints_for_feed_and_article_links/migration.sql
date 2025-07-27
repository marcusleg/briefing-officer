/*
  Warnings:

  - A unique constraint covering the columns `[userId,feedId,link]` on the table `Article` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,link]` on the table `Feed` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Article_link_key";

-- DropIndex
DROP INDEX "Feed_link_key";

-- CreateIndex
CREATE UNIQUE INDEX "Article_userId_feedId_link_key" ON "Article"("userId", "feedId", "link");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_userId_link_key" ON "Feed"("userId", "link");
