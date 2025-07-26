-- CreateTable
CREATE TABLE "TokenUsage" (
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,

    PRIMARY KEY ("userId", "date", "model"),
    CONSTRAINT "TokenUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
