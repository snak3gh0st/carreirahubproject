CREATE INDEX IF NOT EXISTS "customers_createdAt_idx" ON "customers"("createdAt");

CREATE INDEX IF NOT EXISTS "deals_customerId_idx" ON "deals"("customerId");
CREATE INDEX IF NOT EXISTS "deals_ownerId_idx" ON "deals"("ownerId");
CREATE INDEX IF NOT EXISTS "deals_status_idx" ON "deals"("status");
CREATE INDEX IF NOT EXISTS "deals_createdAt_idx" ON "deals"("createdAt");

CREATE INDEX IF NOT EXISTS "invoices_customerId_idx" ON "invoices"("customerId");
CREATE INDEX IF NOT EXISTS "invoices_dealId_idx" ON "invoices"("dealId");
CREATE INDEX IF NOT EXISTS "invoices_contractId_idx" ON "invoices"("contractId");
CREATE INDEX IF NOT EXISTS "invoices_ownerId_idx" ON "invoices"("ownerId");
CREATE INDEX IF NOT EXISTS "invoices_status_dueDate_idx" ON "invoices"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "invoices_paidAt_idx" ON "invoices"("paidAt");
CREATE INDEX IF NOT EXISTS "invoices_createdAt_idx" ON "invoices"("createdAt");

CREATE INDEX IF NOT EXISTS "contracts_customerId_idx" ON "contracts"("customerId");
CREATE INDEX IF NOT EXISTS "contracts_dealId_idx" ON "contracts"("dealId");
CREATE INDEX IF NOT EXISTS "contracts_status_idx" ON "contracts"("status");
CREATE INDEX IF NOT EXISTS "contracts_sentAt_idx" ON "contracts"("sentAt");
CREATE INDEX IF NOT EXISTS "contracts_createdAt_idx" ON "contracts"("createdAt");
