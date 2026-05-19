DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'pipedrive_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'clint_contact_id'
  ) THEN
    ALTER TABLE "customers" RENAME COLUMN "pipedrive_id" TO "clint_contact_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'lastPipedriveSyncAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'lastClintSyncAt'
  ) THEN
    ALTER TABLE "customers" RENAME COLUMN "lastPipedriveSyncAt" TO "lastClintSyncAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'pipedrive_deal_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'clint_deal_id'
  ) THEN
    ALTER TABLE "deals" RENAME COLUMN "pipedrive_deal_id" TO "clint_deal_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'lastPipedriveSyncAt'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deals' AND column_name = 'lastClintSyncAt'
  ) THEN
    ALTER TABLE "deals" RENAME COLUMN "lastPipedriveSyncAt" TO "lastClintSyncAt";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'pipedrive_person_id'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'clint_contact_id'
  ) THEN
    ALTER TABLE "leads" RENAME COLUMN "pipedrive_person_id" TO "clint_contact_id";
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_config' AND column_name = 'last_pipedrive_sync'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'system_config' AND column_name = 'last_clint_sync'
  ) THEN
    ALTER TABLE "system_config" RENAME COLUMN "last_pipedrive_sync" TO "last_clint_sync";
  END IF;
END $$;

ALTER TABLE "customers"
  ALTER COLUMN "clint_contact_id" TYPE TEXT USING "clint_contact_id"::TEXT;

ALTER TABLE "deals"
  ALTER COLUMN "clint_deal_id" DROP NOT NULL,
  ALTER COLUMN "clint_deal_id" TYPE TEXT USING "clint_deal_id"::TEXT;

ALTER TABLE "leads"
  ALTER COLUMN "clint_contact_id" TYPE TEXT USING "clint_contact_id"::TEXT;

CREATE INDEX IF NOT EXISTS "customers_clint_contact_id_idx" ON "customers"("clint_contact_id");
CREATE INDEX IF NOT EXISTS "leads_clint_contact_id_idx" ON "leads"("clint_contact_id");

ALTER TYPE "LeadSource" ADD VALUE IF NOT EXISTS 'CLINT';
