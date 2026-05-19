ALTER TABLE "invoices"
ADD COLUMN IF NOT EXISTS "quickbooks_invoice_link" TEXT;
