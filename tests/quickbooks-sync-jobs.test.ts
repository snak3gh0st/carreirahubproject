import test from "node:test";
import assert from "node:assert/strict";

import {
  buildQuickBooksFullSyncJob,
  buildQuickBooksIncrementalReconcileJob,
  QUICKBOOKS_FULL_SYNC_JOB_ID,
  QUICKBOOKS_INCREMENTAL_RECONCILE_JOB_ID,
} from "@/lib/utils/quickbooks-sync-jobs";

test("buildQuickBooksIncrementalReconcileJob creates a singleton CDC reconciliation job", () => {
  const job = buildQuickBooksIncrementalReconcileJob();

  assert.equal(job.name, "sync-quickbooks-incremental");
  assert.deepEqual(job.data, {
    syncMode: "cdc-incremental",
    source: "cron-reconciliation",
  });
  assert.equal(job.options.jobId, QUICKBOOKS_INCREMENTAL_RECONCILE_JOB_ID);
  assert.equal(job.options.attempts, 5);
  assert.deepEqual(job.options.backoff, {
    type: "exponential",
    delay: 60_000,
  });
});

test("buildQuickBooksFullSyncJob creates a singleton full sync job", () => {
  const job = buildQuickBooksFullSyncJob();

  assert.equal(job.name, "sync-quickbooks-full");
  assert.deepEqual(job.data, {
    syncCustomers: true,
    syncInvoices: true,
    syncPayments: true,
    syncItems: false,
    syncPriceLevels: false,
    syncPaymentTerms: false,
    maxResults: 1000,
    incremental: false,
    source: "manual-full-sync",
  });
  assert.equal(job.options.jobId, QUICKBOOKS_FULL_SYNC_JOB_ID);
  assert.equal(job.options.attempts, 3);
});
