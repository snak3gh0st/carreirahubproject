import type { JobsOptions } from "bullmq";

export const QUICKBOOKS_INCREMENTAL_RECONCILE_JOB_ID =
  "quickbooks-cron-incremental-reconcile";
export const QUICKBOOKS_FULL_SYNC_JOB_ID = "quickbooks-full-sync";

export interface QuickBooksSyncJobDefinition<TData = Record<string, unknown>> {
  name: string;
  data: TData;
  options: JobsOptions;
}

export function buildQuickBooksIncrementalReconcileJob(): QuickBooksSyncJobDefinition<{
  syncMode: "cdc-incremental";
  source: "cron-reconciliation";
}> {
  return {
    name: "sync-quickbooks-incremental",
    data: {
      syncMode: "cdc-incremental",
      source: "cron-reconciliation",
    },
    options: {
      jobId: QUICKBOOKS_INCREMENTAL_RECONCILE_JOB_ID,
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 60_000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    },
  };
}

export function buildQuickBooksFullSyncJob(): QuickBooksSyncJobDefinition<{
  syncCustomers: true;
  syncInvoices: true;
  syncPayments: true;
  syncItems: false;
  syncPriceLevels: false;
  syncPaymentTerms: false;
  maxResults: 1000;
  incremental: false;
  source: "manual-full-sync";
}> {
  return {
    name: "sync-quickbooks-full",
    data: {
      syncCustomers: true,
      syncInvoices: true,
      syncPayments: true,
      syncItems: false,
      syncPriceLevels: false,
      syncPaymentTerms: false,
      maxResults: 1000,
      incremental: false,
      source: "manual-full-sync",
    },
    options: {
      jobId: QUICKBOOKS_FULL_SYNC_JOB_ID,
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 60_000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    },
  };
}
