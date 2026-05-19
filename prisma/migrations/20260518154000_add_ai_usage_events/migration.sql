CREATE TABLE "ai_usage_events" (
  "id" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'openai',
  "model" TEXT,
  "externalEventId" TEXT,
  "testId" TEXT,
  "customerId" TEXT,
  "inputTextTokens" INTEGER NOT NULL DEFAULT 0,
  "cachedInputTextTokens" INTEGER NOT NULL DEFAULT 0,
  "inputAudioTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTextTokens" INTEGER NOT NULL DEFAULT 0,
  "outputAudioTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "estimatedCostUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_usage_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_usage_events_externalEventId_key"
  ON "ai_usage_events"("externalEventId");

CREATE INDEX "ai_usage_events_source_createdAt_idx"
  ON "ai_usage_events"("source", "createdAt");

CREATE INDEX "ai_usage_events_customerId_createdAt_idx"
  ON "ai_usage_events"("customerId", "createdAt");

CREATE INDEX "ai_usage_events_testId_idx"
  ON "ai_usage_events"("testId");
