/*
  Warnings:

  - You are about to drop the column `publiationDate` on the `Article` table. All the data in the column will be lost.
  - Added the required column `publicationDate` to the `Article` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Article" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "publicationDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "content" TEXT,
    "link" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "feedId" INTEGER NOT NULL,
    CONSTRAINT "Article_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Article" ("content", "createdAt", "description", "feedId", "id", "link", "title", "updatedAt") SELECT "content", "createdAt", "description", "feedId", "id", "link", "title", "updatedAt" FROM "Article";
DROP TABLE "Article";
ALTER TABLE "new_Article" RENAME TO "Article";
CREATE UNIQUE INDEX "Article_link_key" ON "Article"("link");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
