ALTER TABLE "ops_student_profiles"
  ADD COLUMN IF NOT EXISTS "seniority" TEXT,
  ADD COLUMN IF NOT EXISTS "canvaUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "studentMaterialUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "renewalAdjustmentReason" TEXT,
  ADD COLUMN IF NOT EXISTS "pauseExtensionDays" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ops_student_documents"
  ADD COLUMN IF NOT EXISTS "resourceType" TEXT NOT NULL DEFAULT 'FILE',
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'INTERNAL',
  ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;

ALTER TABLE "ops_student_activities"
  ADD COLUMN IF NOT EXISTS "jobUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "salary" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT,
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'INTERNAL';

ALTER TABLE "mentorship_sessions"
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'REALIZADO',
  ADD COLUMN IF NOT EXISTS "rescheduleCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "phase_transitions"
  ADD COLUMN IF NOT EXISTS "reason" TEXT;

ALTER TABLE "ops_student_comments"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'SUPORTE',
  ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'INTERNAL';

CREATE INDEX IF NOT EXISTS "ops_student_documents_visibility_idx" ON "ops_student_documents"("visibility");
CREATE INDEX IF NOT EXISTS "ops_student_activities_status_idx" ON "ops_student_activities"("status");
CREATE INDEX IF NOT EXISTS "ops_student_activities_visibility_idx" ON "ops_student_activities"("visibility");
CREATE INDEX IF NOT EXISTS "mentorship_sessions_status_idx" ON "mentorship_sessions"("status");
CREATE INDEX IF NOT EXISTS "ops_student_comments_category_idx" ON "ops_student_comments"("category");
CREATE INDEX IF NOT EXISTS "ops_student_comments_visibility_idx" ON "ops_student_comments"("visibility");

UPDATE "mentorship_phases"
SET "label" = 'Em processo de revisão'
WHERE "key" = 'material';
