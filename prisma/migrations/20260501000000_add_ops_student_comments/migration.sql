CREATE TABLE "ops_student_comments" (
    "id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "authorId" TEXT,

    CONSTRAINT "ops_student_comments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ops_student_comments_enrollmentId_createdAt_idx" ON "ops_student_comments"("enrollmentId", "createdAt");
CREATE INDEX "ops_student_comments_authorId_idx" ON "ops_student_comments"("authorId");

ALTER TABLE "ops_student_comments" ADD CONSTRAINT "ops_student_comments_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "mentorship_enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ops_student_comments" ADD CONSTRAINT "ops_student_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ops_student_comments" OWNER TO carreirausa;
GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE "ops_student_comments" TO carreirausa;
