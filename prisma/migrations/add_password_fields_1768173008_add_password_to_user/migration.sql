-- Add password fields to User model for phase 04 (Production Authentication)
-- These fields enable password hashing and tracking when passwords are set/updated

ALTER TABLE "users" ADD COLUMN "password" TEXT;
ALTER TABLE "users" ADD COLUMN "passwordHashedAt" TIMESTAMP(3);

-- Add index on id field for query optimization
CREATE INDEX "users_id_idx" ON "users"("id");
