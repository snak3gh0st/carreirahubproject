ALTER TABLE "system_config"
ADD COLUMN IF NOT EXISTS "last_clint_sync" TIMESTAMP(3);
