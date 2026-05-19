CREATE TYPE "AiHub" AS ENUM ('FINANCIAL', 'COMMERCIAL', 'OPERATIONAL', 'ADMIN_EXECUTIVE');

ALTER TABLE "ai_conversations"
ADD COLUMN "hub" "AiHub" NOT NULL DEFAULT 'ADMIN_EXECUTIVE';

DROP INDEX IF EXISTS "ai_conversations_userId_updatedAt_idx";
CREATE INDEX "ai_conversations_userId_hub_updatedAt_idx"
ON "ai_conversations"("userId", "hub", "updatedAt");
