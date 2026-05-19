CREATE TABLE "ai_mock_interview_sessions" (
  "id" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "model" TEXT NOT NULL DEFAULT 'gpt-realtime-2',
  "openaiCallId" TEXT,
  "targetRole" TEXT,
  "interviewFocus" TEXT,
  "resumeSnapshot" TEXT,
  "cvContext" JSONB,
  "transcript" JSONB,
  "report" JSONB,
  "overallScore" INTEGER,
  "communicationScore" INTEGER,
  "experienceScore" INTEGER,
  "problemSolvingScore" INTEGER,
  "roleFitScore" INTEGER,
  "executivePresenceScore" INTEGER,
  "hiringSignal" TEXT,
  "summary" TEXT,
  "strengths" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "risks" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "focusAreas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "suggestedPracticeQuestions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "durationSeconds" INTEGER,
  "opsSessionId" TEXT,
  "usageInputTextTokens" INTEGER NOT NULL DEFAULT 0,
  "usageCachedInputTextTokens" INTEGER NOT NULL DEFAULT 0,
  "usageInputAudioTokens" INTEGER NOT NULL DEFAULT 0,
  "usageOutputTextTokens" INTEGER NOT NULL DEFAULT 0,
  "usageOutputAudioTokens" INTEGER NOT NULL DEFAULT 0,
  "usageTotalTokens" INTEGER NOT NULL DEFAULT 0,
  "usageEstimatedCostUsd" DECIMAL(10,4),
  "usageCapturedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "customerId" TEXT NOT NULL,
  "enrollmentId" TEXT,

  CONSTRAINT "ai_mock_interview_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_mock_interview_sessions_customerId_createdAt_idx"
  ON "ai_mock_interview_sessions"("customerId", "createdAt");

CREATE INDEX "ai_mock_interview_sessions_enrollmentId_createdAt_idx"
  ON "ai_mock_interview_sessions"("enrollmentId", "createdAt");

CREATE INDEX "ai_mock_interview_sessions_status_idx"
  ON "ai_mock_interview_sessions"("status");

ALTER TABLE "ai_mock_interview_sessions"
  ADD CONSTRAINT "ai_mock_interview_sessions_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "customers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ai_mock_interview_sessions"
  ADD CONSTRAINT "ai_mock_interview_sessions_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "mentorship_enrollments"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
