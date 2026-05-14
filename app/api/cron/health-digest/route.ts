import { NextRequest, NextResponse } from "next/server";
import { AutoChargeStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { telegramService } from "@/lib/services/telegram.service";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";
import { queues } from "@/lib/utils/queue";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

type LogSummary = {
  byService: Record<string, { ok: number; err: number }>;
  totalOk: number;
  totalErr: number;
};

type HealthPayload = {
  ok: boolean;
  checks: Record<string, { ok: boolean; detail?: string }>;
};

function summarizeLogs(
  logs: Array<{ service: string; status: string; _count: { id: number } }>
): LogSummary {
  const byService: Record<string, { ok: number; err: number }> = {};
  let totalOk = 0;
  let totalErr = 0;

  for (const row of logs) {
    const svc = row.service;
    if (!byService[svc]) byService[svc] = { ok: 0, err: 0 };
    if (row.status === "SUCCESS" || row.status === "success") {
      byService[svc].ok += row._count.id;
      totalOk += row._count.id;
    } else {
      byService[svc].err += row._count.id;
      totalErr += row._count.id;
    }
  }

  return { byService, totalOk, totalErr };
}

async function summarizeIntegrationWindow(since: Date) {
  const logs = await prisma.integrationLog.groupBy({
    by: ["service", "status"],
    where: { createdAt: { gte: since } },
    _count: { id: true },
  });

  return summarizeLogs(logs);
}

async function getQueueSummary() {
  const queueDefs = [
    ["lead", queues.leadQualification],
    ["whatsapp", queues.whatsappMessages],
    ["invoice_generation", queues.invoiceGeneration],
    ["invoice_approval", queues.invoiceApproval],
    ["contract_generation", queues.contractGeneration],
    ["quickbooks_sync", queues.quickbooksSync],
    ["bulk_import", queues.bulkImport],
  ] as const;

  try {
    const rows = await Promise.all(
      queueDefs.map(async ([name, queue]) => {
        const counts = await queue.getJobCounts(
          "waiting",
          "active",
          "delayed",
          "failed"
        );
        return {
          name,
          waiting: counts.waiting || 0,
          active: counts.active || 0,
          delayed: counts.delayed || 0,
          failed: counts.failed || 0,
        };
      })
    );

    return {
      ok: rows.every(
        (row) =>
          row.waiting === 0 &&
          row.active === 0 &&
          row.delayed === 0 &&
          row.failed === 0
      ),
      rows,
      error: null as string | null,
    };
  } catch (error) {
    return {
      ok: false,
      rows: [] as Array<{
        name: string;
        waiting: number;
        active: number;
        delayed: number;
        failed: number;
      }>,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export const GET = withCronTelemetry("health-digest", async (request: NextRequest) => {
  const now = Date.now();
  const since15m = new Date(now - 15 * 60 * 1000);
  const since60m = new Date(now - 60 * 60 * 1000);
  const since24h = new Date(now - 24 * 60 * 60 * 1000);

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const healthPromise: Promise<HealthPayload> = fetch(`${baseUrl}/api/health`, {
    cache: "no-store",
  })
    .then((res) => res.json() as Promise<HealthPayload>)
    .catch((): HealthPayload => ({
      ok: false,
      checks: {
        fetch: { ok: false, detail: "failed to reach /api/health" },
      },
    }));

  const [
    health,
    logs15m,
    logs60m,
    logs24h,
    config,
    circuitBreakers,
    queueSummary,
    recentErrors,
    sentEmailNullCount,
    overdueCandidateCount,
    staleAutoChargeCount,
    wrongRealmIgnoredCount,
  ] = await Promise.all([
    healthPromise,
    summarizeIntegrationWindow(since15m),
    summarizeIntegrationWindow(since60m),
    summarizeIntegrationWindow(since24h),
    prisma.systemConfig.findUnique({
      where: { id: "system" },
      select: {
        quickbooks_company_id: true,
        quickbooks_is_authenticated: true,
        quickbooks_token_expires_at: true,
        last_qb_sync: true,
      },
    }),
    prisma.circuitBreakerState.findMany({
      where: {
        serviceName: {
          in: ["quickbooks", "quickbooks_payments", "telegram", "email"],
        },
      },
      select: {
        serviceName: true,
        state: true,
        failureCount: true,
        successCount: true,
        updatedAt: true,
      },
      orderBy: { serviceName: "asc" },
    }),
    getQueueSummary(),
    prisma.integrationLog.findMany({
      where: {
        createdAt: { gte: since60m },
        status: { notIn: ["SUCCESS", "success"] },
      },
      select: {
        createdAt: true,
        service: true,
        action: true,
        status: true,
        error: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.invoice.count({
      where: {
        status: InvoiceStatus.SENT,
        emailSentAt: null,
        quickbooks_invoice_id: { not: null },
      },
    }),
    prisma.invoice.count({
      where: {
        dueDate: { lt: new Date(now) },
        status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
      },
    }),
    prisma.invoice.count({
      where: {
        nextAutoChargeRetry: { lte: new Date(now) },
        autoChargeStatus: {
          in: [
            AutoChargeStatus.RETRY_PENDING,
            AutoChargeStatus.FAILED,
            AutoChargeStatus.SKIPPED,
          ],
        },
      },
    }),
    prisma.integrationLog.count({
      where: {
        service: "QUICKBOOKS",
        action: "WEBHOOK_WRONG_REALM_IGNORED",
        createdAt: { gte: since24h },
      },
    }),
  ]);

  const openCircuitBreakers = circuitBreakers.filter(
    (breaker) => breaker.state !== "CLOSED"
  );
  const queueIssueTotal = queueSummary.rows.reduce(
    (sum, row) => sum + row.waiting + row.active + row.delayed + row.failed,
    0
  );
  const hasFinanceWarnings =
    overdueCandidateCount > 0 || staleAutoChargeCount > 0;

  const statusEmoji =
    health.ok &&
    logs15m.totalErr === 0 &&
    openCircuitBreakers.length === 0 &&
    queueSummary.ok &&
    !hasFinanceWarnings
      ? "✅"
      : "⚠️";

  const lines: string[] = [
    `${statusEmoji} <b>CarreiraHub — Daily Health Digest</b>`,
    "",
    "<b>Infrastructure</b>",
  ];

  for (const [key, check] of Object.entries(health.checks)) {
    const icon = check.ok ? "🟢" : "🔴";
    const detail = check.detail ? ` — ${esc(check.detail)}` : "";
    lines.push(`${icon} ${esc(key)}${detail}`);
  }

  lines.push("", "<b>Current Runs</b>");
  lines.push(
    `• 15m: ${logs15m.totalOk + logs15m.totalErr} (✅ ${logs15m.totalOk} · ❌ ${logs15m.totalErr})`
  );
  lines.push(
    `• 60m: ${logs60m.totalOk + logs60m.totalErr} (✅ ${logs60m.totalOk} · ❌ ${logs60m.totalErr})`
  );
  lines.push(
    `• 24h: ${logs24h.totalOk + logs24h.totalErr} (✅ ${logs24h.totalOk} · ❌ ${logs24h.totalErr})`
  );

  lines.push("", "<b>QuickBooks</b>");
  lines.push(
    `${config?.quickbooks_is_authenticated ? "🟢" : "🔴"} auth — realm ${esc(config?.quickbooks_company_id || "missing")}`
  );
  lines.push(
    `• token expires: ${esc(config?.quickbooks_token_expires_at?.toISOString() || "missing")}`
  );
  lines.push(
    `• last sync: ${esc(config?.last_qb_sync?.toISOString() || "missing")}`
  );
  if (wrongRealmIgnoredCount > 0) {
    lines.push(`• ignored wrong realms in 24h: ${wrongRealmIgnoredCount}`);
  }

  lines.push("", "<b>Circuit Breakers</b>");
  for (const breaker of circuitBreakers) {
    const icon = breaker.state === "CLOSED" ? "🟢" : "🔴";
    lines.push(
      `${icon} ${esc(breaker.serviceName)} — ${esc(breaker.state)} (fail ${breaker.failureCount}, ok ${breaker.successCount})`
    );
  }

  lines.push("", "<b>Queues</b>");
  if (queueSummary.error) {
    lines.push(`🔴 queue check failed — ${esc(queueSummary.error)}`);
  } else if (queueIssueTotal === 0) {
    lines.push("🟢 all monitored queues empty");
  } else {
    for (const row of queueSummary.rows.filter(
      (item) =>
        item.waiting > 0 ||
        item.active > 0 ||
        item.delayed > 0 ||
        item.failed > 0
    )) {
      lines.push(
        `⚠️ ${esc(row.name)} — wait ${row.waiting}, active ${row.active}, delayed ${row.delayed}, failed ${row.failed}`
      );
    }
  }

  lines.push("", "<b>Invoice Signals</b>");
  lines.push(
    `${overdueCandidateCount > 0 ? "⚠️" : "🟢"} SENT/PARTIALLY_PAID past due: ${overdueCandidateCount}`
  );
  lines.push(
    `${staleAutoChargeCount > 0 ? "⚠️" : "🟢"} auto-charge retry stale/skipped: ${staleAutoChargeCount}`
  );
  lines.push(`ℹ️ SENT with no Hub emailSentAt: ${sentEmailNullCount}`);

  const errServices = Object.entries(logs24h.byService)
    .filter(([, v]) => v.err > 0)
    .sort((a, b) => b[1].err - a[1].err);

  if (errServices.length > 0) {
    lines.push("", "<b>Historical 24h Error Totals</b>");
    for (const [svc, counts] of errServices) {
      lines.push(`• ${esc(svc)}: ❌ ${counts.err} / ${counts.ok + counts.err}`);
    }
  }

  if (recentErrors.length > 0) {
    lines.push("", "<b>Recent Errors</b>");
    for (const item of recentErrors) {
      lines.push(
        `• ${esc(item.createdAt.toISOString())} ${esc(item.service)}.${esc(item.action)} — ${esc(item.error || item.status)}`
      );
    }
  }

  lines.push("", `<i>${new Date().toISOString()}</i>`);

  await telegramService.send(lines.join("\n"), { parse_mode: "HTML" });

  return NextResponse.json({
    success: true,
    healthOk: health.ok,
    windows: {
      "15m": logs15m,
      "60m": logs60m,
      "24h": logs24h,
    },
    quickbooks: {
      realmId: config?.quickbooks_company_id,
      authenticated: config?.quickbooks_is_authenticated,
      tokenExpiresAt: config?.quickbooks_token_expires_at,
      lastSyncAt: config?.last_qb_sync,
      wrongRealmIgnoredCount,
    },
    queueSummary,
    invoiceSignals: {
      overdueCandidateCount,
      staleAutoChargeCount,
      sentEmailNullCount,
    },
  });
});

export const POST = GET;
