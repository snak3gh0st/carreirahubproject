import { AutoChargeStatus, InvoiceStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ACCESS_AUDIT_SERVICE } from "@/lib/admin/access-audit";
import { summarizeInvoiceHealthSignals } from "@/lib/invoices/invoice-health";
import { getEffectiveSyncTimestamps } from "@/lib/integrations/sync-health";
import { getDigisacConfig } from "@/lib/services/digisac.service";
import { queues } from "@/lib/utils/queue";

export type HealthLevel = "healthy" | "warning" | "critical";

export type StatusCountInput = Array<{ status: string; count: number }>;

export const ADMIN_HEALTH_CRON_JOBS = [
  {
    name: "process-queue",
    label: "Process Queue",
    route: "/api/cron/process-queue",
    schedule: "Every 5 min",
    expectedEveryMinutes: 10,
  },
  {
    name: "evaluate-alerts",
    label: "Evaluate Alerts",
    route: "/api/cron/evaluate-alerts",
    schedule: "Hourly",
    expectedEveryMinutes: 90,
  },
  {
    name: "monitor-queues",
    label: "Monitor Queues",
    route: "/api/cron/monitor-queues",
    schedule: "Every 4h",
    expectedEveryMinutes: 300,
  },
  {
    name: "overdue-invoice-alerts",
    label: "Overdue Invoice Alerts",
    route: "/api/cron/overdue-invoice-alerts",
    schedule: "Every 6h",
    expectedEveryMinutes: 420,
  },
  {
    name: "auto-charge-invoices",
    label: "Auto Charge Invoices",
    route: "/api/cron/auto-charge-invoices",
    schedule: "Daily 00:30 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "refresh-qb-token",
    label: "Refresh QB Token",
    route: "/api/cron/refresh-quickbooks-token",
    schedule: "Every 45 min",
    expectedEveryMinutes: 70,
  },
  {
    name: "quickbooks-sync",
    label: "QuickBooks Sync",
    route: "/api/cron/quickbooks-sync",
    schedule: "Every 6h",
    expectedEveryMinutes: 420,
  },
  {
    name: "overdue-invoices",
    label: "Overdue Invoices",
    route: "/api/cron/overdue-invoices",
    schedule: "Daily 02:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "clint-sync",
    label: "Clint Sync",
    route: "/api/cron/clint-sync",
    schedule: "Daily 03:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "send-scheduled-invoices",
    label: "Send Scheduled Invoices",
    route: "/api/cron/send-scheduled-invoices",
    schedule: "Daily 09:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "invoice-payment-reminder",
    label: "Invoice Payment Reminder",
    route: "/api/cron/invoice-payment-reminder",
    schedule: "Daily 10:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "contract-expiration",
    label: "Contract Expiration",
    route: "/api/cron/contract-expiration",
    schedule: "Daily 01:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "contract-renewal-reminder",
    label: "Contract Renewal Reminder",
    route: "/api/cron/contract-renewal-reminder",
    schedule: "Daily 07:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "collection-calls",
    label: "Collection Calls",
    route: "/api/cron/collection-calls",
    schedule: "Daily 13:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "cfo-analysis",
    label: "CFO Analysis",
    route: "/api/cron/cfo-analysis",
    schedule: "Daily 08:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "seller-digest",
    label: "Seller Digest",
    route: "/api/cron/seller-digest",
    schedule: "Daily 08:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "finance-digest",
    label: "Finance Digest",
    route: "/api/cron/finance-digest",
    schedule: "Daily 08:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "health-digest",
    label: "Health Digest",
    route: "/api/cron/health-digest",
    schedule: "Daily 08:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "ops-daily-digest",
    label: "Ops Daily Digest",
    route: "/api/cron/ops-daily-digest",
    schedule: "Daily 08:15 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "admin-digest",
    label: "Admin Digest",
    route: "/api/cron/admin-digest",
    schedule: "Monday 08:00 UTC",
    expectedEveryMinutes: 11520,
  },
  {
    name: "daily-ar-digest",
    label: "Daily AR Digest",
    route: "/api/cron/daily-ar-digest",
    schedule: "Daily 09:00 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "form-completion-reminder",
    label: "Form Completion Reminder",
    route: "/api/cron/form-completion-reminder",
    schedule: "Daily 09:15 UTC",
    expectedEveryMinutes: 1620,
  },
  {
    name: "daily-bi-digest",
    label: "Daily BI Digest",
    route: "/api/cron/daily-bi-digest",
    schedule: "Daily 21:00 UTC",
    expectedEveryMinutes: 1620,
  },
] as const;

type CronJobDef = (typeof ADMIN_HEALTH_CRON_JOBS)[number];

const DOCUSIGN_TEMPLATE_KEYS = [
  "DOCUSIGN_TEMPLATE_AVULSO",
  "DOCUSIGN_TEMPLATE_COMBO",
  "DOCUSIGN_TEMPLATE_EARLY_CAREER",
  "DOCUSIGN_TEMPLATE_NEW_PASS",
  "DOCUSIGN_TEMPLATE_PASS",
  "DOCUSIGN_TEMPLATE_PASS_ADVANCED",
  "DOCUSIGN_TEMPLATE_START",
  "DOCUSIGN_TEMPLATE_TREINAMENTO",
  "DOCUSIGN_TEMPLATE_UPGRADE",
];

type MonitoredServiceDef = {
  key: string;
  label: string;
  category: string;
  infraKey?: string;
  logServices?: readonly string[];
  circuitNames?: readonly string[];
  requiredEnv?: readonly string[];
  requiredAnyEnv?: readonly string[];
  optionalEnv?: readonly string[];
};

const ADMIN_HEALTH_MONITORED_SERVICES: readonly MonitoredServiceDef[] = [
  {
    key: "database",
    label: "Database",
    category: "Infrastructure",
    infraKey: "db",
    requiredAnyEnv: ["POSTGRES_PRISMA_URL", "DATABASE_URL"],
  },
  {
    key: "redis",
    label: "Redis / BullMQ",
    category: "Infrastructure",
    infraKey: "redis",
    requiredEnv: ["REDIS_URL"],
  },
  {
    key: "quickbooks",
    label: "QuickBooks Accounting",
    category: "Accounting",
    infraKey: "quickbooks",
    logServices: ["QUICKBOOKS"],
    circuitNames: ["quickbooks"],
    requiredEnv: [
      "QUICKBOOKS_CLIENT_ID",
      "QUICKBOOKS_CLIENT_SECRET",
      "QUICKBOOKS_COMPANY_ID",
      "QUICKBOOKS_REDIRECT_URI",
    ],
  },
  {
    key: "quickbooks_payments",
    label: "QuickBooks Payments",
    category: "Payments",
    logServices: ["quickbooks_payments", "QUICKBOOKS_PAYMENTS"],
    circuitNames: ["quickbooks_payments"],
    requiredEnv: ["QUICKBOOKS_CLIENT_ID", "QUICKBOOKS_CLIENT_SECRET", "QUICKBOOKS_ENVIRONMENT"],
  },
  {
    key: "docusign",
    label: "DocuSign",
    category: "Contracts",
    logServices: ["DOCUSIGN"],
    circuitNames: ["docusign"],
    requiredEnv: [
      "DOCUSIGN_ACCOUNT_ID",
      "DOCUSIGN_BASE_URL",
      "DOCUSIGN_INTEGRATION_KEY",
      "DOCUSIGN_PRIVATE_KEY",
      "DOCUSIGN_USER_ID",
    ],
    optionalEnv: ["DOCUSIGN_WEBHOOK_SECRET", ...DOCUSIGN_TEMPLATE_KEYS],
  },
  {
    key: "telegram",
    label: "Telegram Alerts",
    category: "Ops Alerts",
    logServices: ["TELEGRAM"],
    circuitNames: ["telegram"],
    requiredEnv: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  },
  {
    key: "digisac",
    label: "Digisac WhatsApp",
    category: "Messaging",
    infraKey: "digisac",
    logServices: ["DIGISAC"],
    circuitNames: ["digisac"],
    requiredEnv: ["DIGISAC_API_BASE_URL", "DIGISAC_API_TOKEN", "DIGISAC_SERVICE_ID"],
  },
  {
    key: "email",
    label: "Resend Email",
    category: "Messaging",
    logServices: ["EMAIL", "RESEND"],
    circuitNames: ["email", "resend"],
    requiredEnv: ["RESEND_API_KEY", "EMAIL_FROM"],
    optionalEnv: ["RESEND_WEBHOOK_SECRET"],
  },
  {
    key: "openai",
    label: "OpenAI / AI",
    category: "AI",
    logServices: ["OPENAI", "AI", "CFO_ANALYSIS"],
    circuitNames: ["openai", "ai"],
    requiredEnv: ["OPENAI_API_KEY"],
    optionalEnv: ["AI_MODEL_DEFAULT", "AI_COPILOT_ENABLED"],
  },
  {
    key: "slack",
    label: "Slack Ops (planned)",
    category: "Ops Alerts",
    logServices: ["slack"],
    optionalEnv: [
      "SLACK_BOT_TOKEN",
      "SLACK_CHANNEL_COMMERCIAL",
      "SLACK_CHANNEL_BASTAO",
      "SLACK_CHANNEL_ENGLISH_TEST",
    ],
  },
  {
    key: "clint",
    label: "Clint CRM",
    category: "CRM",
    logServices: ["CLINT", "clint-sync"],
    circuitNames: ["clint"],
    requiredEnv: ["CLINT_API_KEY"],
    optionalEnv: ["CLINT_WEBHOOK_SECRET"],
  },
];

export function cronActionName(name: string) {
  return name.toUpperCase().replace(/-/g, "_");
}

export function isSuccessStatus(status: string) {
  return status === "SUCCESS" || status === "success";
}

export function summarizeStatusCounts(rows: StatusCountInput) {
  return rows.reduce(
    (acc, row) => {
      if (isSuccessStatus(row.status)) {
        acc.ok += row.count;
      } else {
        acc.err += row.count;
      }
      return acc;
    },
    { ok: 0, err: 0 }
  );
}

export function classifyCronRun({
  lastRunAt,
  expectedEveryMinutes,
  now = new Date(),
}: {
  lastRunAt: Date | null;
  expectedEveryMinutes: number;
  now?: Date;
}): HealthLevel {
  if (!lastRunAt) return "critical";

  const ageMinutes = (now.getTime() - lastRunAt.getTime()) / 60000;
  if (ageMinutes > expectedEveryMinutes * 2) return "critical";
  if (ageMinutes > expectedEveryMinutes * 1.25) return "warning";
  return "healthy";
}

export function deriveOverallHealthLevel(input: {
  criticalInfraCount: number;
  warningInfraCount: number;
  criticalCronCount: number;
  warningCronCount: number;
  errorCount24h: number;
  queueIssueTotal: number;
  openCircuitBreakers: number;
  invoiceWarningCount: number;
  syncWarningCount: number;
  criticalServiceCount?: number;
  warningServiceCount?: number;
}): HealthLevel {
  if (
    input.criticalInfraCount > 0 ||
    input.criticalCronCount > 0 ||
    input.openCircuitBreakers > 0 ||
    (input.criticalServiceCount ?? 0) > 0
  ) {
    return "critical";
  }

  if (
    input.warningInfraCount > 0 ||
    input.warningCronCount > 0 ||
    input.errorCount24h > 0 ||
    input.queueIssueTotal > 0 ||
    input.invoiceWarningCount > 0 ||
    input.syncWarningCount > 0 ||
    (input.warningServiceCount ?? 0) > 0
  ) {
    return "warning";
  }

  return "healthy";
}

async function checkRedis() {
  const url = process.env.REDIS_URL;
  if (!url) {
    return { key: "redis", label: "Redis", level: "critical" as HealthLevel, detail: "REDIS_URL missing" };
  }

  try {
    const parsed = new URL(url);
    const Redis = (await import("ioredis")).default;
    const client = new Redis(url, {
      connectTimeout: 5000,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    await client.connect();
    await client.ping();
    client.disconnect();
    return { key: "redis", label: "Redis", level: "healthy" as HealthLevel, detail: parsed.hostname };
  } catch (error) {
    return {
      key: "redis",
      label: "Redis",
      level: "critical" as HealthLevel,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function getInfrastructureChecks(now: Date) {
  const checks = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.push({ key: "db", label: "Database", level: "healthy" as HealthLevel, detail: "Postgres reachable" });
  } catch (error) {
    checks.push({
      key: "db",
      label: "Database",
      level: "critical" as HealthLevel,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  checks.push(await checkRedis());

  const config = await prisma.systemConfig.findUnique({
    where: { id: "system" },
    select: {
      quickbooks_is_authenticated: true,
      quickbooks_company_id: true,
      quickbooks_token_expires_at: true,
      quickbooks_access_token: true,
    },
  });

  const qbExpiresAt = config?.quickbooks_token_expires_at ?? null;
  const qbMinutesLeft = qbExpiresAt
    ? Math.round((qbExpiresAt.getTime() - now.getTime()) / 60000)
    : null;
  const qbLevel: HealthLevel =
    !config?.quickbooks_is_authenticated || !config?.quickbooks_access_token
      ? "critical"
      : qbMinutesLeft !== null && qbMinutesLeft <= 0
        ? "critical"
        : qbMinutesLeft !== null && qbMinutesLeft < 15
          ? "warning"
          : "healthy";

  checks.push({
    key: "quickbooks",
    label: "QuickBooks Token",
    level: qbLevel,
    detail: qbExpiresAt
      ? `realm ${config?.quickbooks_company_id || "missing"} - expires ${qbExpiresAt.toISOString()}`
      : "missing token expiry",
  });

  try {
    const digisac = getDigisacConfig();
    if (!digisac.enabled) {
      checks.push({
        key: "digisac",
        label: "Digisac",
        level: "warning" as HealthLevel,
        detail: `Missing ${digisac.missing.join(", ")}`,
      });
    } else {
      const res = await fetch(`${digisac.apiBaseUrl}/services/${digisac.serviceId}`, {
        headers: { Authorization: `Bearer ${digisac.apiToken}` },
        signal: AbortSignal.timeout(5000),
      });
      checks.push({
        key: "digisac",
        label: "Digisac",
        level: res.ok ? "healthy" as HealthLevel : "warning" as HealthLevel,
        detail: res.ok ? `service ${digisac.serviceId}` : `API ${res.status}`,
      });
    }
  } catch (error) {
    checks.push({
      key: "digisac",
      label: "Digisac",
      level: "warning" as HealthLevel,
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  return checks;
}

function countLevel<T extends { level: HealthLevel }>(rows: T[], level: HealthLevel) {
  return rows.filter((row) => row.level === level).length;
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
        const counts = await queue.getJobCounts("waiting", "active", "delayed", "failed");
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
      ok: true,
      error: null as string | null,
      rows,
      issueTotal: rows.reduce((sum, row) => sum + row.waiting + row.active + row.delayed + row.failed, 0),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      rows: [] as Array<{ name: string; waiting: number; active: number; delayed: number; failed: number }>,
      issueTotal: 1,
    };
  }
}

async function getCronRows(now: Date, since24h: Date) {
  const actions = ADMIN_HEALTH_CRON_JOBS.map((job) => cronActionName(job.name));
  const sinceLookback = new Date(now.getTime() - 9 * 24 * 60 * 60 * 1000);
  const logs = await prisma.integrationLog.findMany({
    where: {
      service: "CRON",
      action: { in: actions },
      createdAt: { gte: sinceLookback },
    },
    select: {
      action: true,
      status: true,
      error: true,
      durationMs: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return ADMIN_HEALTH_CRON_JOBS.map((job: CronJobDef) => {
    const action = cronActionName(job.name);
    const jobLogs = logs.filter((log) => log.action === action);
    const lastRun = jobLogs[0] ?? null;
    const last24h = jobLogs.filter((log) => log.createdAt >= since24h);
    const counts = summarizeStatusCounts(
      last24h.map((log) => ({ status: log.status, count: 1 }))
    );
    const freshnessLevel = classifyCronRun({
      lastRunAt: lastRun?.createdAt ?? null,
      expectedEveryMinutes: job.expectedEveryMinutes,
      now,
    });
    const level =
      lastRun && !isSuccessStatus(lastRun.status)
        ? "critical"
        : freshnessLevel;

    return {
      ...job,
      action,
      level,
      lastRunAt: lastRun?.createdAt ?? null,
      lastStatus: lastRun?.status ?? null,
      lastError: lastRun?.error ?? null,
      lastDurationMs: lastRun?.durationMs ?? null,
      ok24h: counts.ok,
      err24h: counts.err,
    };
  });
}

function hasEnvValue(key: string) {
  return Boolean(process.env[key]?.trim());
}

function missingRequiredEnv(def: MonitoredServiceDef) {
  const missing = [...(def.requiredEnv ?? [])].filter((key) => !hasEnvValue(key));
  const anyMissing =
    def.requiredAnyEnv && def.requiredAnyEnv.length > 0 && !def.requiredAnyEnv.some(hasEnvValue)
      ? [`one of ${def.requiredAnyEnv.join(" or ")}`]
      : [];
  return [...missing, ...anyMissing];
}

function optionalEnvSummary(keys: readonly string[] | undefined) {
  if (!keys?.length) return null;
  const configured = keys.filter(hasEnvValue).length;
  return `${configured}/${keys.length} optional keys`;
}

function serviceAlias(service: string) {
  return service.toLowerCase();
}

function activeCircuitNames() {
  return new Set(
    ADMIN_HEALTH_MONITORED_SERVICES
      .flatMap((service) => [...(service.circuitNames ?? [])])
      .map((name) => name.toLowerCase())
  );
}

async function getMonitoredServiceRows({
  infrastructure,
  serviceMap,
  circuitBreakers,
  since24h,
}: {
  infrastructure: Array<{ key: string; level: HealthLevel; detail: string }>;
  serviceMap: Map<string, { service: string; ok24h: number; err24h: number }>;
  circuitBreakers: Array<{
    serviceName: string;
    state: string;
    failureCount: number;
    successCount: number;
    updatedAt: Date;
  }>;
  since24h: Date;
}) {
  const logServices = [
    ...new Set(
      ADMIN_HEALTH_MONITORED_SERVICES.flatMap((service) => [...(service.logServices ?? [])])
    ),
  ];
  const latestLogs = logServices.length
    ? await prisma.integrationLog.findMany({
        where: {
          service: { in: logServices },
          createdAt: { gte: since24h },
        },
        select: {
          service: true,
          action: true,
          status: true,
          error: true,
          createdAt: true,
          durationMs: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const latestByService = new Map<string, (typeof latestLogs)[number]>();
  for (const log of latestLogs) {
    const key = serviceAlias(log.service);
    if (!latestByService.has(key)) latestByService.set(key, log);
  }

  const infraByKey = new Map(infrastructure.map((row) => [row.key, row]));
  const breakerByName = new Map(
    circuitBreakers.map((breaker) => [breaker.serviceName.toLowerCase(), breaker])
  );

  return ADMIN_HEALTH_MONITORED_SERVICES.map((service) => {
    const missingEnv = missingRequiredEnv(service);
    const infra = service.infraKey ? infraByKey.get(service.infraKey) : null;
    const breakers = [...(service.circuitNames ?? [])]
      .map((name) => breakerByName.get(name.toLowerCase()))
      .filter(Boolean) as Array<{
        serviceName: string;
        state: string;
        failureCount: number;
        successCount: number;
        updatedAt: Date;
      }>;
    const openBreaker = breakers.find((breaker) => breaker.state !== "CLOSED");

    const grouped = (service.logServices ?? []).reduce(
      (acc, name) => {
        const byExact = serviceMap.get(name);
        const byCase = [...serviceMap.values()].find(
          (row) => serviceAlias(row.service) === serviceAlias(name)
        );
        const row = byExact ?? byCase;
        return {
          ok24h: acc.ok24h + (row?.ok24h ?? 0),
          err24h: acc.err24h + (row?.err24h ?? 0),
        };
      },
      { ok24h: 0, err24h: 0 }
    );

    const latestLog = (service.logServices ?? [])
      .map((name) => latestByService.get(serviceAlias(name)))
      .find(Boolean);

    let level: HealthLevel = "healthy";
    if (infra?.level) level = infra.level;
    if (missingEnv.length > 0) level = "critical";
    if (openBreaker) level = "critical";
    if (latestLog && !isSuccessStatus(latestLog.status) && level === "healthy") level = "warning";

    const extras = optionalEnvSummary(service.optionalEnv);
    const detailParts = [
      missingEnv.length > 0 ? `Missing ${missingEnv.join(", ")}` : "configured",
      infra?.detail,
      openBreaker ? `circuit ${openBreaker.state}` : breakers.length > 0 ? "circuit closed" : null,
      extras,
    ].filter(Boolean);

    return {
      key: service.key,
      label: service.label,
      category: service.category,
      level,
      detail: detailParts.join(" · "),
      ok24h: grouped.ok24h,
      err24h: grouped.err24h,
      latestAt: latestLog?.createdAt ?? null,
      latestAction: latestLog?.action ?? null,
      latestStatus: latestLog?.status ?? null,
      latestError: latestLog?.error ?? null,
    };
  });
}

function asAuditMetadata(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, any>;
  }
  return value as Record<string, any>;
}

async function getAccessAuditRows(since24h: Date) {
  const baseWhere = {
    service: ACCESS_AUDIT_SERVICE,
    createdAt: { gte: since24h },
  } as const;

  const [aggregateLogs, recentLogs] = await Promise.all([
    prisma.integrationLog.findMany({
      where: baseWhere,
      select: {
        id: true,
        action: true,
        status: true,
        error: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.integrationLog.findMany({
      where: baseWhere,
      select: {
        id: true,
        action: true,
        status: true,
        error: true,
        createdAt: true,
        metadata: true,
      },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  const mapRow = (log: (typeof aggregateLogs)[number]) => {
      const metadata = asAuditMetadata(log.metadata);
      return {
        id: log.id,
        createdAt: log.createdAt,
        action: log.action,
        status: log.status,
        error: log.error,
        actorType: metadata.actorType || null,
        actorName: metadata.actorName || null,
        userId: metadata.userId || null,
        clientUserId: metadata.clientUserId || null,
        customerId: metadata.customerId || null,
        email: metadata.email || null,
        role: metadata.role || null,
        method: metadata.method || null,
        path: metadata.path || null,
        statusCode: metadata.statusCode || null,
        ip: metadata.ip || null,
        host: metadata.host || null,
        userAgent: metadata.userAgent || null,
        routeType: metadata.routeType || null,
      };
    };

  const aggregateRows = aggregateLogs.map(mapRow);
  const recentRows = recentLogs.map(mapRow);

  const isRealActor = (row: (typeof aggregateRows)[number]) =>
    row.actorType !== "anonymous" &&
    Boolean(row.email || row.actorName || row.userId || row.clientUserId || row.customerId);

  const authenticatedRows = aggregateRows.filter(isRealActor);
  const anonymousRows = aggregateRows.filter((row) => !isRealActor(row));
  const recentAuthenticatedRows = recentRows.filter(isRealActor);

  const uniqueUsers = new Map<string, {
    key: string;
    email: string | null;
    actorName: string | null;
    actorType: string | null;
    role: string | null;
    lastSeenAt: Date;
    events24h: number;
    loginEvents24h: number;
    hubEvents24h: number;
    hubApiEvents24h: number;
    dashboardEvents24h: number;
    dashboardApiEvents24h: number;
    opsEvents24h: number;
    opsApiEvents24h: number;
    lastPath: string | null;
    lastAction: string;
  }>();

  for (const row of authenticatedRows) {
    const key = String(row.email || row.userId || row.clientUserId || row.customerId || row.actorName);
    const current = uniqueUsers.get(key);
    if (!current) {
      uniqueUsers.set(key, {
        key,
        email: row.email,
        actorName: row.actorName,
        actorType: row.actorType,
        role: row.role,
        lastSeenAt: row.createdAt,
        events24h: 1,
        loginEvents24h: row.action.endsWith("_LOGIN_SUCCESS") ? 1 : 0,
        hubEvents24h: row.routeType === "hub" ? 1 : 0,
        hubApiEvents24h: row.routeType === "hub_api" ? 1 : 0,
        dashboardEvents24h: row.routeType === "dashboard" ? 1 : 0,
        dashboardApiEvents24h: row.routeType === "dashboard_api" ? 1 : 0,
        opsEvents24h: row.routeType === "ops" ? 1 : 0,
        opsApiEvents24h: row.routeType === "ops_api" ? 1 : 0,
        lastPath: row.path,
        lastAction: row.action,
      });
    } else {
      current.events24h += 1;
      current.loginEvents24h += row.action.endsWith("_LOGIN_SUCCESS") ? 1 : 0;
      current.hubEvents24h += row.routeType === "hub" ? 1 : 0;
      current.hubApiEvents24h += row.routeType === "hub_api" ? 1 : 0;
      current.dashboardEvents24h += row.routeType === "dashboard" ? 1 : 0;
      current.dashboardApiEvents24h += row.routeType === "dashboard_api" ? 1 : 0;
      current.opsEvents24h += row.routeType === "ops" ? 1 : 0;
      current.opsApiEvents24h += row.routeType === "ops_api" ? 1 : 0;
      if (row.createdAt > current.lastSeenAt) {
        current.lastSeenAt = row.createdAt;
        current.lastPath = row.path;
        current.lastAction = row.action;
      }
    }
  }

  const summary = {
    total24h: aggregateRows.length,
    authenticatedEvents24h: authenticatedRows.length,
    anonymousEvents24h: anonymousRows.length,
    uniqueAuthenticatedUsers24h: uniqueUsers.size,
    uniqueClientUsers24h: [...uniqueUsers.values()].filter((user) => user.actorType === "client").length,
    uniqueInternalUsers24h: [...uniqueUsers.values()].filter((user) => user.actorType === "internal").length,
    loginSuccess24h: authenticatedRows.filter((row) => row.action.endsWith("_LOGIN_SUCCESS")).length,
    loginFailure24h: authenticatedRows.filter((row) => row.action.endsWith("_LOGIN_FAILED")).length,
    clientLoginSuccess24h: authenticatedRows.filter((row) => row.action === "CLIENT_LOGIN_SUCCESS").length,
    internalLoginSuccess24h: authenticatedRows.filter((row) => row.action === "INTERNAL_LOGIN_SUCCESS").length,
    endpointAccess24h: authenticatedRows.filter((row) => row.action === "ENDPOINT_ACCESS").length,
    endpointDenied24h: aggregateRows.filter((row) => row.action === "ENDPOINT_DENIED").length,
    anonymousDenied24h: anonymousRows.filter((row) => row.action === "ENDPOINT_DENIED").length,
    hubEvents24h: authenticatedRows.filter((row) => row.routeType === "hub").length,
    hubApiEvents24h: authenticatedRows.filter((row) => row.routeType === "hub_api").length,
    dashboardEvents24h: authenticatedRows.filter((row) => row.routeType === "dashboard").length,
    dashboardApiEvents24h: authenticatedRows.filter((row) => row.routeType === "dashboard_api").length,
    opsEvents24h: authenticatedRows.filter((row) => row.routeType === "ops").length,
    opsApiEvents24h: authenticatedRows.filter((row) => row.routeType === "ops_api").length,
  };

  return {
    summary,
    users: [...uniqueUsers.values()]
      .sort((a, b) => b.lastSeenAt.getTime() - a.lastSeenAt.getTime()),
    rows: recentAuthenticatedRows,
    anonymousRows,
  };
}

export async function getAdminSystemHealth() {
  const now = new Date();
  const since60m = new Date(now.getTime() - 60 * 60 * 1000);
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    infrastructure,
    cronRows,
    integrationGroups,
    recentFailures,
    effectiveSyncs,
    systemConfig,
    circuitBreakers,
    queueSummary,
    invoiceHealthCandidates,
    wrongRealmIgnoredCount,
    accessAudit,
  ] = await Promise.all([
    getInfrastructureChecks(now),
    getCronRows(now, since24h),
    prisma.integrationLog.groupBy({
      by: ["service", "status"],
      where: {
        createdAt: { gte: since24h },
        service: { not: ACCESS_AUDIT_SERVICE },
      },
      _count: { id: true },
    }),
    prisma.integrationLog.findMany({
      where: {
        createdAt: { gte: since60m },
        status: { notIn: ["SUCCESS", "success"] },
        service: { not: ACCESS_AUDIT_SERVICE },
      },
      select: {
        id: true,
        createdAt: true,
        service: true,
        action: true,
        status: true,
        error: true,
        durationMs: true,
      },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    getEffectiveSyncTimestamps(),
    prisma.systemConfig.findUnique({
      where: { id: "system" },
      select: {
        quickbooks_company_id: true,
        quickbooks_is_authenticated: true,
        quickbooks_token_expires_at: true,
        last_qb_sync: true,
        last_clint_sync: true,
      },
    }),
    prisma.circuitBreakerState.findMany({
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
    Promise.all([
      prisma.invoice.findMany({
        where: {
          status: { notIn: [InvoiceStatus.PAID, InvoiceStatus.VOID] },
          emailSentAt: null,
          OR: [
            { quickbooks_invoice_id: { not: null } },
            { status: InvoiceStatus.DRAFT },
          ],
        },
        select: {
          status: true,
          dueDate: true,
          emailSentAt: true,
          emailSendAttempts: true,
          quickbooks_invoice_id: true,
          installments: true,
          customer: {
            select: {
              email: true,
            },
          },
        },
      }),
      prisma.invoice.count({
        where: {
          dueDate: { lt: now },
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.PARTIALLY_PAID] },
        },
      }),
      prisma.invoice.count({
        where: {
          nextAutoChargeRetry: { lte: now },
          autoChargeStatus: {
            in: [
              AutoChargeStatus.RETRY_PENDING,
              AutoChargeStatus.FAILED,
              AutoChargeStatus.SKIPPED,
            ],
          },
        },
      }),
    ]),
    prisma.integrationLog.count({
      where: {
        service: "QUICKBOOKS",
        action: "WEBHOOK_WRONG_REALM_IGNORED",
        createdAt: { gte: since24h },
      },
    }),
    getAccessAuditRows(since24h),
  ]);

  const serviceMap = new Map<string, { service: string; ok24h: number; err24h: number }>();
  for (const row of integrationGroups) {
    const current = serviceMap.get(row.service) ?? {
      service: row.service,
      ok24h: 0,
      err24h: 0,
    };
    if (isSuccessStatus(row.status)) {
      current.ok24h += row._count.id;
    } else {
      current.err24h += row._count.id;
    }
    serviceMap.set(row.service, current);
  }

  const services = [...serviceMap.values()].sort((a, b) => b.err24h - a.err24h || b.ok24h - a.ok24h);
  const totalRuns24h = services.reduce((sum, row) => sum + row.ok24h + row.err24h, 0);
  const totalErrors24h = services.reduce((sum, row) => sum + row.err24h, 0);
  const monitoredServices = await getMonitoredServiceRows({
    infrastructure,
    serviceMap,
    circuitBreakers,
    since24h,
  });
  const monitoredCircuitNames = activeCircuitNames();
  const openCircuitBreakers = circuitBreakers.filter(
    (breaker) =>
      breaker.state !== "CLOSED" &&
      monitoredCircuitNames.has(breaker.serviceName.toLowerCase())
  );
  const [invoiceHealthRows, overdueCandidateCount, staleAutoChargeCount] =
    invoiceHealthCandidates;
  const invoiceSignals = summarizeInvoiceHealthSignals(
    invoiceHealthRows.map((row) => ({
      status: row.status,
      dueDate: row.dueDate,
      emailSentAt: row.emailSentAt,
      emailSendAttempts: row.emailSendAttempts,
      quickbooks_invoice_id: row.quickbooks_invoice_id,
      installments: row.installments,
      customerEmail: row.customer.email,
    })),
    now
  );
  const {
    sendWindowPendingCount,
    publishWindowPendingCount,
    qbCreatedAwaitingSendCount,
    localFutureInstallmentCount,
    legacyQbFutureUnsentCount,
    stalePastDueUnsentCount,
  } = invoiceSignals;

  const syncRows = [
    {
      key: "quickbooks",
      label: "QuickBooks",
      lastSyncAt: effectiveSyncs.quickbooksLastSync,
      level:
        !effectiveSyncs.quickbooksLastSync ||
        now.getTime() - effectiveSyncs.quickbooksLastSync.getTime() > 6 * 60 * 60 * 1000
          ? "warning" as HealthLevel
          : "healthy" as HealthLevel,
      detail: systemConfig?.quickbooks_is_authenticated
        ? `realm ${systemConfig.quickbooks_company_id || "missing"}`
        : "not authenticated",
    },
    {
      key: "clint",
      label: "Clint",
      lastSyncAt: effectiveSyncs.clintLastSync,
      level:
        !effectiveSyncs.clintLastSync ||
        now.getTime() - effectiveSyncs.clintLastSync.getTime() > 30 * 60 * 60 * 1000
          ? "warning" as HealthLevel
          : "healthy" as HealthLevel,
      detail: "CRM sync",
    },
  ];

  const invoiceWarningCount =
    overdueCandidateCount +
    staleAutoChargeCount +
    sendWindowPendingCount +
    stalePastDueUnsentCount;

  const overallLevel = deriveOverallHealthLevel({
    criticalInfraCount: countLevel(infrastructure, "critical"),
    warningInfraCount: countLevel(infrastructure, "warning"),
    criticalCronCount: countLevel(cronRows, "critical"),
    warningCronCount: countLevel(cronRows, "warning"),
    errorCount24h: recentFailures.length,
    queueIssueTotal: queueSummary.issueTotal,
    openCircuitBreakers: openCircuitBreakers.length,
    invoiceWarningCount,
    syncWarningCount: countLevel(syncRows, "warning"),
    criticalServiceCount: countLevel(monitoredServices, "critical"),
    warningServiceCount: countLevel(monitoredServices, "warning"),
  });

  return {
    generatedAt: now,
    environment: process.env.NODE_ENV || "unknown",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || null,
    scheduler: {
      primary: "systemd timers on carreirausa",
      fallback: "deploy/carreirahub-cron",
      note: "Cron health is derived from CRON integration logs written by each route.",
    },
    overall: {
      level: overallLevel,
      totalRuns24h,
      totalErrors24h,
      criticalCronCount: countLevel(cronRows, "critical"),
      warningCronCount: countLevel(cronRows, "warning"),
      openCircuitBreakers: openCircuitBreakers.length,
      queueIssueTotal: queueSummary.issueTotal,
      invoiceWarningCount,
      criticalServiceCount: countLevel(monitoredServices, "critical"),
      warningServiceCount: countLevel(monitoredServices, "warning"),
    },
    infrastructure,
    monitoredServices,
    cronRows,
    services,
    recentFailures,
    syncRows,
    quickbooks: {
      authenticated: systemConfig?.quickbooks_is_authenticated ?? false,
      realmId: systemConfig?.quickbooks_company_id ?? null,
      tokenExpiresAt: systemConfig?.quickbooks_token_expires_at ?? null,
      lastSyncAt: systemConfig?.last_qb_sync ?? effectiveSyncs.quickbooksLastSync,
      wrongRealmIgnoredCount,
    },
    queues: queueSummary,
    circuitBreakers,
    invoiceSignals: {
      sendWindowPendingCount,
      publishWindowPendingCount,
      qbCreatedAwaitingSendCount,
      localFutureInstallmentCount,
      legacyQbFutureUnsentCount,
      stalePastDueUnsentCount,
      overdueCandidateCount,
      staleAutoChargeCount,
    },
    accessAudit,
  };
}
