ALTER TABLE "english_realtime_tests"
  ADD COLUMN "usageInputTextTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "usageCachedInputTextTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "usageInputAudioTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "usageOutputTextTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "usageOutputAudioTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "usageTotalTokens" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "usageEstimatedCostUsd" DECIMAL(10,4),
  ADD COLUMN "usageCapturedAt" TIMESTAMP(3);
