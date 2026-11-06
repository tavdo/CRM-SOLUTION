CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" DATETIME NOT NULL
);
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");
