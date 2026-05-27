import { NextResponse } from "next/server";
import { docusignContractSyncService } from "@/lib/services/docusign-contract-sync.service";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/docusign-sync
 *
 * Reconciles DocuSign envelopes with our contracts. Catches up on any
 * webhook events that did not arrive (signed status, signedAt timestamp,
 * voided/declined statuses).
 *
 * Schedule: every 15 minutes via Swarm host cron.
 *
 * Strategy:
 * - Only walks contracts in non-final status (SENT_FOR_SIGNATURE, VIEWED, etc.)
 *   via syncOpenContracts — fast, only touches the envelopes that can change.
 * - The heavier email-based reconciliation (scans every completed envelope to
 *   backfill historical customers) is skipped here; trigger it manually via
 *   POST /api/docusign/sync/contracts when needed.
 */
export const GET = withCronTelemetry("docusign-sync", async () => {
  const startedAt = Date.now();

  try {
    // syncOpenContracts is the realtime path: only contracts in non-terminal status
    const result = await docusignContractSyncService.syncOpenContracts();

    const durationMs = Date.now() - startedAt;

    await prisma.integrationLog
      .create({
        data: {
          service: "DOCUSIGN",
          action: "CONTRACT_SYNC_CRON",
          status: "SUCCESS",
          payload: {
            durationMs,
            total: result.total,
            synced: result.synced,
            changed: result.changed,
            errors: result.errors,
          },
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: true, durationMs, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync failed";

    await prisma.integrationLog
      .create({
        data: {
          service: "DOCUSIGN",
          action: "CONTRACT_SYNC_CRON",
          status: "ERROR",
          error: message,
        },
      })
      .catch(() => {});

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
});

export const POST = GET;
