CREATE TABLE "ops_staff_members" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "status" TEXT NOT NULL DEFAULT 'FORMER',
  "areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ops_staff_members_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_staff_members_status_idx" ON "ops_staff_members"("status");
CREATE INDEX "ops_staff_members_name_idx" ON "ops_staff_members"("name");

ALTER TABLE "ops_student_activities"
  ADD COLUMN "performedByUserId" TEXT,
  ADD COLUMN "performedByStaffId" TEXT;

CREATE INDEX "ops_student_activities_performedByUserId_idx" ON "ops_student_activities"("performedByUserId");
CREATE INDEX "ops_student_activities_performedByStaffId_idx" ON "ops_student_activities"("performedByStaffId");

ALTER TABLE "ops_student_activities"
  ADD CONSTRAINT "ops_student_activities_performedByUserId_fkey"
  FOREIGN KEY ("performedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_student_activities"
  ADD CONSTRAINT "ops_student_activities_performedByStaffId_fkey"
  FOREIGN KEY ("performedByStaffId") REFERENCES "ops_staff_members"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mentorship_sessions"
  ADD COLUMN "performedByUserId" TEXT,
  ADD COLUMN "performedByStaffId" TEXT;

CREATE INDEX "mentorship_sessions_performedByUserId_idx" ON "mentorship_sessions"("performedByUserId");
CREATE INDEX "mentorship_sessions_performedByStaffId_idx" ON "mentorship_sessions"("performedByStaffId");

ALTER TABLE "mentorship_sessions"
  ADD CONSTRAINT "mentorship_sessions_performedByUserId_fkey"
  FOREIGN KEY ("performedByUserId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mentorship_sessions"
  ADD CONSTRAINT "mentorship_sessions_performedByStaffId_fkey"
  FOREIGN KEY ("performedByStaffId") REFERENCES "ops_staff_members"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
