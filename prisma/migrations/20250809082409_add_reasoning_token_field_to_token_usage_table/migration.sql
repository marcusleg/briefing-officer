-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TokenUsage" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "reasoningTokens" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("userId", "date", "model"),
    CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TokenUsage" ("date", "inputTokens", "model", "outputTokens", "userId") SELECT "date", "inputTokens", "model", "outputTokens", "userId" FROM "TokenUsage";
DROP TABLE "TokenUsage";
ALTER TABLE "new_TokenUsage" RENAME TO "TokenUsage";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
