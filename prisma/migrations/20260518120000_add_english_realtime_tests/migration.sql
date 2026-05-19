-- CreateTable
CREATE TABLE "english_realtime_tests" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "model" TEXT NOT NULL DEFAULT 'gpt-realtime-2',
    "openaiCallId" TEXT,
    "cefrLevel" TEXT,
    "displayLevel" TEXT,
    "score" INTEGER,
    "fluencyScore" INTEGER,
    "pronunciationScore" INTEGER,
    "grammarScore" INTEGER,
    "vocabularyScore" INTEGER,
    "comprehensionScore" INTEGER,
    "summary" TEXT,
    "strengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "focusAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "transcript" JSONB,
    "durationSeconds" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customerId" TEXT NOT NULL,

    CONSTRAINT "english_realtime_tests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "english_realtime_tests_customerId_createdAt_idx" ON "english_realtime_tests"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "english_realtime_tests_status_idx" ON "english_realtime_tests"("status");

-- AddForeignKey
ALTER TABLE "english_realtime_tests" ADD CONSTRAINT "english_realtime_tests_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
