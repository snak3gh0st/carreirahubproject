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
 * - Default fromDate: 7 days ago (covers any webhook miss within a week)
 * - Limited pages so a single cron run finishes quickly
 * - Uses docusignContractSyncService.syncAllContracts to walk our contracts
 *   and pull each envelope's current status from DocuSign API
 */
export const GET = withCronTelemetry("docusign-sync", async () => {
  const fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const startedAt = Date.now();

  try {
    const result = await docusignContractSyncService.syncAllContracts({
      fromDate,
      maxPages: 5,
      pageSize: 100,
    });

    const durationMs = Date.now() - startedAt;

    await prisma.integrationLog
      .create({
        data: {
          service: "DOCUSIGN",
          action: "CONTRACT_SYNC_CRON",
          status: "SUCCESS",
          payload: {
            fromDate: fromDate.toISOString(),
            durationMs,
            ...result,
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
