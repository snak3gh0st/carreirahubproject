import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  KeyRound,
  LogIn,
  MousePointerClick,
  PlugZap,
  RefreshCw,
  Server,
  ShieldAlert,
  TimerReset,
  UserCheck,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import {
  type HealthLevel,
  getAdminSystemHealth,
} from "@/lib/admin/system-health";
import { AdminHealthActions } from "@/components/admin/admin-health-actions";

export const dynamic = "force-dynamic";

const levelStyles: Record<HealthLevel, string> = {
  healthy: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  critical: "border-red-200 bg-red-50 text-red-800",
};

const levelDot: Record<HealthLevel, string> = {
  healthy: "bg-emerald-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatAge(value: Date | string | null | undefined, now: Date) {
  if (!value) return "missing";
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function levelLabel(level: HealthLevel) {
  if (level === "healthy") return "Healthy";
  if (level === "warning") return "Warning";
  return "Critical";
}

function StatusPill({ level }: { level: HealthLevel }) {
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${levelStyles[level]}`}>
      <span className={`h-2 w-2 rounded-full ${levelDot[level]}`} />
      {levelLabel(level)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon,
  level = "healthy",
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
  level?: HealthLevel;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-brand-verde/10 text-brand-verde">
          {icon}
        </div>
        <StatusPill level={level} />
      </div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-gray-950">{value}</p>
      <p className="mt-2 text-xs text-gray-500">{detail}</p>
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
        <p className="text-sm text-gray-500">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function accessActionLabel(action: string) {
  const labels: Record<string, string> = {
    INTERNAL_LOGIN_SUCCESS: "Internal login",
    INTERNAL_LOGIN_FAILED: "Internal login failed",
    CLIENT_LOGIN_SUCCESS: "Client login",
    CLIENT_LOGIN_FAILED: "Client login failed",
    ENDPOINT_ACCESS: "Endpoint access",
    ENDPOINT_DENIED: "Endpoint denied",
  };
  return labels[action] || action.replace(/_/g, " ").toLowerCase();
}

function userAgentLabel(value: string | null | undefined) {
  if (!value) return "unknown device";
  if (value.includes("Mobile")) return "Mobile browser";
  if (value.includes("Safari") && !value.includes("Chrome")) return "Safari";
  if (value.includes("Chrome")) return "Chrome";
  return value.slice(0, 42);
}

export default async function AdminSystemHealthPage() {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/dashboard?error=role_not_permitted");
  }

  const health = await getAdminSystemHealth();
  const generatedAt = new Date(health.generatedAt);
  const failingServices = health.services.filter((service) => service.err24h > 0);
  const monitoredServiceIssues = health.monitoredServices.filter((service) => service.level !== "healthy");
  const cronIssues = health.cronRows.filter((cron) => cron.level !== "healthy");
  const queueIssues = health.queues.rows.filter(
    (row) => row.waiting > 0 || row.active > 0 || row.delayed > 0 || row.failed > 0
  );
  const accessRows = health.accessAudit.rows;
  const activeUsers = health.accessAudit.users;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-verde">Hub Admin</p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-gray-950">System Health</h1>
              <StatusPill level={health.overall.level} />
            </div>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Infra, scheduler, cron runs, syncs, queues and operational failures in one admin surface.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="rounded-md border border-gray-200 bg-white px-3 py-2 text-gray-600">
              Updated {formatDate(generatedAt)}
            </span>
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 rounded-md bg-brand-verde px-3 py-2 font-semibold text-white transition hover:bg-brand-verde/90"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Runs 24h"
            value={health.overall.totalRuns24h}
            detail={`${health.overall.totalErrors24h} failures in integration logs`}
            icon={<Activity className="h-5 w-5" />}
            level={health.overall.totalErrors24h > 0 ? "warning" : "healthy"}
          />
          <MetricCard
            label="Cron Issues"
            value={health.overall.criticalCronCount + health.overall.warningCronCount}
            detail={`${health.overall.criticalCronCount} critical, ${health.overall.warningCronCount} warning`}
            icon={<TimerReset className="h-5 w-5" />}
            level={health.overall.criticalCronCount > 0 ? "critical" : health.overall.warningCronCount > 0 ? "warning" : "healthy"}
          />
          <MetricCard
            label="Queue Load"
            value={health.overall.queueIssueTotal}
            detail={health.queues.error || "waiting + active + delayed + failed"}
            icon={<GitBranch className="h-5 w-5" />}
            level={health.overall.queueIssueTotal > 0 ? "warning" : "healthy"}
          />
          <MetricCard
            label="Invoice Signals"
            value={health.overall.invoiceWarningCount}
            detail="due emails, overdue invoices and stale auto-charge retries"
            icon={<ShieldAlert className="h-5 w-5" />}
            level={health.overall.invoiceWarningCount > 0 ? "warning" : "healthy"}
          />
        </div>

        <AdminHealthActions />

        <section className="mb-8">
          <SectionHeader
            title="Access Logs"
            subtitle="Authenticated users only in the main table; anonymous traffic is counted separately."
            action={
              <span className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500">
                Last 24h · {activeUsers.length} users · latest {accessRows.length}
              </span>
            }
          />
          <div className="mb-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Logins"
              value={health.accessAudit.summary.loginSuccess24h}
              detail={`${health.accessAudit.summary.loginFailure24h} failed attempts`}
              icon={<LogIn className="h-5 w-5" />}
              level={health.accessAudit.summary.loginFailure24h > 0 ? "warning" : "healthy"}
            />
            <MetricCard
              label="Authenticated Uses"
              value={health.accessAudit.summary.endpointAccess24h}
              detail="dashboard, ops and client hub requests by real users"
              icon={<MousePointerClick className="h-5 w-5" />}
            />
            <MetricCard
              label="Blocked"
              value={health.accessAudit.summary.endpointDenied24h}
              detail={`${health.accessAudit.summary.anonymousDenied24h} anonymous/session blocks`}
              icon={<Ban className="h-5 w-5" />}
              level={health.accessAudit.summary.endpointDenied24h > 0 ? "warning" : "healthy"}
            />
            <MetricCard
              label="Active Users"
              value={health.accessAudit.summary.uniqueAuthenticatedUsers24h}
              detail={`${health.accessAudit.summary.authenticatedEvents24h} authenticated events, ${health.accessAudit.summary.anonymousEvents24h} anonymous`}
              icon={<UserCheck className="h-5 w-5" />}
            />
          </div>
          <div className="mb-4 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="grid divide-y divide-gray-100 md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
              {activeUsers.length === 0 ? (
                <div className="p-4 text-sm text-gray-500 md:col-span-2 xl:col-span-4">
                  No authenticated user activity in the last 24h.
                </div>
              ) : (
                activeUsers.slice(0, 8).map((user) => (
                  <div key={user.key} className="p-4">
                    <p className="truncate text-sm font-semibold text-gray-950">
                      {user.email || user.actorName || user.key}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {user.role || user.actorType || "user"} · {user.events24h} events
                    </p>
                    <p className="mt-2 truncate text-xs text-gray-400">
                      {formatAge(user.lastSeenAt, generatedAt)} · {user.lastPath || user.lastAction}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Time</th>
                    <th className="px-4 py-3">Who</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Endpoint</th>
                    <th className="px-4 py-3">Origin</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accessRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-500">
                        No authenticated access audit events yet. Anonymous blocks are excluded from this table.
                      </td>
                    </tr>
                  ) : (
                    accessRows.map((row) => {
                      const failed = row.status !== "SUCCESS" && row.status !== "success";
                      return (
                        <tr key={row.id} className={failed ? "bg-red-50/40" : "bg-white"}>
                          <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                            <p>{formatAge(row.createdAt, generatedAt)}</p>
                            <p className="mt-1 text-xs text-gray-400">{formatDate(row.createdAt)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-gray-950">
                              {row.email || row.actorName || row.actorType || "anonymous"}
                            </p>
                            <p className="text-xs text-gray-500">{row.role || row.actorType || "unknown"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{accessActionLabel(row.action)}</p>
                            {row.error && <p className="mt-1 text-xs text-red-600">{row.error}</p>}
                          </td>
                          <td className="px-4 py-3">
                            <code className="break-all rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                              {row.method ? `${row.method} ` : ""}
                              {row.path || "unknown"}
                            </code>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <p>{row.ip || "unknown IP"}</p>
                            <p className="mt-1 text-xs text-gray-400">{row.host || userAgentLabel(row.userAgent)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                              failed ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {row.statusCode || row.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <SectionHeader
            title="Infrastructure"
            subtitle={`${health.scheduler.primary}. ${health.scheduler.note}`}
            action={
              <span className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-500">
                {health.appUrl || "app url missing"}
              </span>
            }
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {health.infrastructure.map((check) => (
              <div key={check.key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-brand-verde" />
                    <h3 className="text-sm font-semibold text-gray-950">{check.label}</h3>
                  </div>
                  <StatusPill level={check.level} />
                </div>
                <p className="break-words text-sm text-gray-500">{check.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <SectionHeader
            title="Service Monitor"
            subtitle="API keys, circuit breakers, last activity and 24h failure counts for every active integration."
            action={
              monitoredServiceIssues.length > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  {monitoredServiceIssues.length} needs attention
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  All services configured
                </span>
              )
            }
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {health.monitoredServices.map((service) => (
              <div key={service.key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <KeyRound className="h-5 w-5 shrink-0 text-brand-verde" />
                      <h3 className="truncate text-sm font-semibold text-gray-950">{service.label}</h3>
                    </div>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-400">
                      {service.category}
                    </p>
                  </div>
                  <StatusPill level={service.level} />
                </div>
                <p className="min-h-[40px] break-words text-sm text-gray-600">{service.detail}</p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-md bg-gray-50 p-2">
                    <p className="text-gray-400">OK 24h</p>
                    <p className="mt-1 font-semibold text-emerald-700">{service.ok24h}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2">
                    <p className="text-gray-400">Errors</p>
                    <p className={`mt-1 font-semibold ${service.err24h > 0 ? "text-red-700" : "text-gray-700"}`}>
                      {service.err24h}
                    </p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-2">
                    <p className="text-gray-400">Latest</p>
                    <p className="mt-1 truncate font-semibold text-gray-700">{formatAge(service.latestAt, generatedAt)}</p>
                  </div>
                </div>
                {service.latestAction && (
                  <p className="mt-3 truncate text-xs text-gray-400">
                    {service.latestAction} · {service.latestStatus || "unknown"}
                  </p>
                )}
                {service.latestError && (
                  <p className="mt-2 line-clamp-2 text-xs text-red-600">{service.latestError}</p>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <SectionHeader
            title="Cron Jobs"
            subtitle="Freshness is based on CRON integration logs written by each route."
            action={
              cronIssues.length > 0 ? (
                <span className="inline-flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <AlertTriangle className="h-4 w-4" />
                  {cronIssues.length} needs attention
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  All monitored crons fresh
                </span>
              )
            }
          />
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="max-h-[560px] overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Last Run</th>
                    <th className="px-4 py-3">24h</th>
                    <th className="px-4 py-3">Route</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {health.cronRows.map((cron) => (
                    <tr key={cron.name} className={cron.level === "healthy" ? "bg-white" : "bg-amber-50/40"}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-950">{cron.label}</p>
                        {cron.lastError && (
                          <p className="mt-1 max-w-sm truncate text-xs text-red-600">{cron.lastError}</p>
                        )}
                      </td>
                      <td className="px-4 py-3"><StatusPill level={cron.level} /></td>
                      <td className="px-4 py-3 text-gray-600">{cron.schedule}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-2">
                          <Clock3 className="h-4 w-4 text-gray-400" />
                          <span>{formatAge(cron.lastRunAt, generatedAt)}</span>
                        </div>
                        <p className="mt-1 text-xs text-gray-400">{formatDate(cron.lastRunAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-emerald-700">{cron.ok24h}</span>
                        <span className="px-1 text-gray-300">/</span>
                        <span className={cron.err24h > 0 ? "font-semibold text-red-700" : "text-gray-500"}>{cron.err24h}</span>
                      </td>
                      <td className="px-4 py-3">
                        <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{cron.route}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <div className="mb-8 grid gap-8 xl:grid-cols-[1fr_420px]">
          <section>
            <SectionHeader
              title="Failures"
              subtitle="IntegrationLog errors in the last 24h, grouped by service."
            />
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              {failingServices.length === 0 ? (
                <div className="flex items-center gap-3 rounded-md bg-emerald-50 p-4 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-semibold">No integration failures in the last 24h.</span>
                </div>
              ) : (
                <div className="space-y-3">
                  {failingServices.slice(0, 10).map((service) => (
                    <div key={service.service} className="flex items-center justify-between gap-4 rounded-md border border-gray-100 bg-gray-50 px-4 py-3">
                      <div>
                        <p className="font-semibold text-gray-950">{service.service}</p>
                        <p className="text-xs text-gray-500">{service.ok24h + service.err24h} runs in 24h</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-red-700">{service.err24h}</p>
                        <p className="text-xs text-gray-500">failures</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Sync" subtitle="Current sync state and integration identity." />
            <div className="space-y-3">
              {health.syncRows.map((sync) => (
                <div key={sync.key} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-brand-verde" />
                      <h3 className="text-sm font-semibold text-gray-950">{sync.label}</h3>
                    </div>
                    <StatusPill level={sync.level} />
                  </div>
                  <p className="text-sm text-gray-600">{sync.detail}</p>
                  <p className="mt-2 text-xs text-gray-500">Last sync {formatAge(sync.lastSyncAt, generatedAt)}</p>
                </div>
              ))}
              <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlugZap className="h-5 w-5 text-brand-verde" />
                    <h3 className="text-sm font-semibold text-gray-950">QuickBooks</h3>
                  </div>
                  <StatusPill level={health.quickbooks.authenticated ? "healthy" : "critical"} />
                </div>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Realm</dt>
                    <dd className="font-medium text-gray-900">{health.quickbooks.realmId || "missing"}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Token</dt>
                    <dd className="text-right font-medium text-gray-900">{formatDate(health.quickbooks.tokenExpiresAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-gray-500">Wrong realm ignored</dt>
                    <dd className="font-medium text-gray-900">{health.quickbooks.wrongRealmIgnoredCount}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-8 xl:grid-cols-2">
          <section>
            <SectionHeader title="Queues" subtitle="BullMQ waiting, active, delayed and failed jobs." />
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              {health.queues.error && (
                <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {health.queues.error}
                </div>
              )}
              {queueIssues.length === 0 ? (
                <p className="text-sm text-gray-600">All monitored queues are empty.</p>
              ) : (
                <div className="space-y-3">
                  {queueIssues.map((queue) => (
                    <div key={queue.name} className="rounded-md border border-gray-100 bg-gray-50 p-3">
                      <p className="font-semibold text-gray-950">{queue.name}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        wait {queue.waiting} · active {queue.active} · delayed {queue.delayed} · failed {queue.failed}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section>
            <SectionHeader title="Recent Errors" subtitle="Last failures from the past 60 minutes." />
            <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
              {health.recentFailures.length === 0 ? (
                <p className="text-sm text-gray-600">No recent errors in the last hour.</p>
              ) : (
                <div className="space-y-3">
                  {health.recentFailures.map((failure) => (
                    <div key={failure.id} className="rounded-md border border-red-100 bg-red-50 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <p className="font-semibold text-red-900">{failure.service}.{failure.action}</p>
                        <span className="text-xs text-red-700">{formatAge(failure.createdAt, generatedAt)}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-sm text-red-800">{failure.error || failure.status}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
