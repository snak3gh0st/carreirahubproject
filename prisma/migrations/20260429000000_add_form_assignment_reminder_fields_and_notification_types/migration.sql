-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT_RENEWAL_WARNING';
ALTER TYPE "NotificationType" ADD VALUE 'OPS_DAILY_DIGEST';
ALTER TYPE "NotificationType" ADD VALUE 'HUB_FORM_REMINDER';

-- AlterTable
ALTER TABLE "form_assignments" ADD COLUMN     "lastReminderAt" TIMESTAMP(3),
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0;
