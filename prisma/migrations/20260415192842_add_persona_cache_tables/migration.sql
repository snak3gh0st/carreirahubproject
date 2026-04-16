-- CreateTable persona_cache_entries
CREATE TABLE "persona_cache_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personaSlug" TEXT NOT NULL,
    "dayBucket" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT
);

-- CreateIndex persona_cache_entries unique constraint
CREATE UNIQUE INDEX "persona_cache_entries_personaSlug_dayBucket_key" ON "persona_cache_entries"("personaSlug", "dayBucket");

-- CreateIndex persona_cache_entries lookup by slug and date
CREATE INDEX "persona_cache_entries_personaSlug_generatedAt_idx" ON "persona_cache_entries"("personaSlug", "generatedAt");

-- CreateTable persona_cache_reads
CREATE TABLE "persona_cache_reads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "personaSlug" TEXT NOT NULL,
    "dayBucket" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex persona_cache_reads unique constraint
CREATE UNIQUE INDEX "persona_cache_reads_personaSlug_dayBucket_userId_key" ON "persona_cache_reads"("personaSlug", "dayBucket", "userId");

-- CreateIndex persona_cache_reads lookup by user
CREATE INDEX "persona_cache_reads_userId_readAt_idx" ON "persona_cache_reads"("userId", "readAt");

-- AlterTable ai_messages: add personaSlug and fromCache columns
ALTER TABLE "ai_messages" ADD COLUMN "personaSlug" TEXT;
ALTER TABLE "ai_messages" ADD COLUMN "fromCache" BOOLEAN NOT NULL DEFAULT false;
