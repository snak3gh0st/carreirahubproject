import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  Clock,
  Users,
  type LucideIcon,
} from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  icon: LucideIcon;
  tone?: "neutral" | "green" | "amber" | "blue" | "red";
}) {
  const toneClasses = {
    neutral: "bg-gray-50 text-gray-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <span className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md", toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold tabular-nums text-gray-950">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{helper}</p>
    </div>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatDateShort(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function daysSince(date: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / (24 * 60 * 60 * 1000)));
}

async function loadOperationalDrillDown(now: Date) {
  const dayMs = 24 * 60 * 60 * 1000;
  const weekStart = new Date(now.getTime() - 7 * dayMs);
  const sevenDaysAgo = new Date(now.getTime() - 7 * dayMs);

  const [
    // Active enrollments + counts per phase (decision-grade phase distribution)
    activeEnrollmentsWithPhase,
    pausedEnrollmentCount,
    completedEnrollmentCount,
    sessionsThisWeekCount,
    // Phase reference labels for distribution table
    phases,
    // Recent transitions (last 7 days)
    recentTransitions,
  ] = await Promise.all([
    // EXECUTIVE operational drill-down — read-only; sourced from MentorshipEnrollment findMany (ACTIVE) with phase
    prisma.mentorshipEnrollment.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        currentPhaseId: true,
        customer: { select: { id: true, name: true, email: true } },
        sessions: {
          orderBy: { sessionDate: "desc" },
          take: 1,
          select: { sessionDate: true },
        },
      },
    }),
    // EXECUTIVE operational drill-down — read-only; sourced from MentorshipEnrollment count (PAUSED)
    prisma.mentorshipEnrollment.count({ where: { status: "PAUSED" } }),
    // EXECUTIVE operational drill-down — read-only; sourced from MentorshipEnrollment count (COMPLETED)
    prisma.mentorshipEnrollment.count({ where: { status: "COMPLETED" } }),
    // EXECUTIVE operational drill-down — read-only; sourced from MentorshipSession count (last 7d)
    prisma.mentorshipSession.count({ where: { sessionDate: { gte: weekStart } } }),
    // EXECUTIVE operational drill-down — read-only; sourced from MentorshipPhase findMany (label lookup)
    prisma.mentorshipPhase.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, key: true, label: true, sortOrder: true },
    }),
    // EXECUTIVE operational drill-down — read-only; sourced from PhaseTransition findMany (last 7d, with enrollment+customer)
    prisma.phaseTransition.findMany({
      where: { createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        createdAt: true,
        fromPhase: { select: { label: true } },
        toPhase: { select: { label: true } },
        enrollment: {
          select: { customer: { select: { name: true } } },
        },
      },
    }),
  ]);

  // Phase distribution — count active enrollments per phase
  const phaseDistribution = new Map<string | null, number>();
  for (const e of activeEnrollmentsWithPhase) {
    const key = e.currentPhaseId;
    phaseDistribution.set(key, (phaseDistribution.get(key) ?? 0) + 1);
  }

  // Students with no session in 7+ days — top 5 by overdueness
  const stuckStudents = activeEnrollmentsWithPhase
    .map((e) => {
      const lastSessionAt = e.sessions[0]?.sessionDate ?? null;
      const overdueDays = lastSessionAt
        ? daysSince(lastSessionAt, now)
        : Number.MAX_SAFE_INTEGER;
      return {
        enrollmentId: e.id,
        customerName: e.customer.name,
        customerEmail: e.customer.email,
        lastSessionAt,
        overdueDays,
      };
    })
    .filter((s) => s.overdueDays >= 7)
    .sort((a, b) => b.overdueDays - a.overdueDays)
    .slice(0, 5);

  const phaseRows = phases.map((phase) => ({
    label: phase.label,
    count: phaseDistribution.get(phase.id) ?? 0,
  }));
  const unassignedCount = phaseDistribution.get(null) ?? 0;
  if (unassignedCount > 0) {
    phaseRows.push({ label: "Sem fase atribuida", count: unassignedCount });
  }

  return {
    activeEnrollmentCount: activeEnrollmentsWithPhase.length,
    pausedEnrollmentCount,
    completedEnrollmentCount,
    sessionsThisWeekCount,
    phaseRows,
    stuckStudents,
    recentTransitions,
  };
}

export default async function ExecutiveOperationalPage() {
  // EXECUTIVE drill-down — read-only; sourced from direct Prisma queries (MentorshipEnrollment + Session + PhaseTransition)
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (role !== "EXECUTIVE" && role !== "ADMIN") {
    redirect("/dashboard?error=role_not_permitted");
  }

  const now = new Date();
  const data = await loadOperationalDrillDown(now);

  const totalActive = data.activeEnrollmentCount;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        {/* Back nav header */}
        {/* D-12: no "Análise completa ↗" link here — the dedicated ops BI at
         * /ops/bi is locked to ADMIN+OPERATIONAL by the Ops portal middleware,
         * so EXECUTIVE cannot reach it. Deferred for a future phase that
         * decides on EXECUTIVE's relationship to the Ops portal. */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/dashboard/executive" className="text-sm text-brand-verde hover:underline">
            ← Briefing Executivo
          </Link>
          <span className="text-gray-300">/</span>
          <h1 className="text-2xl font-semibold text-gray-900">Resumo Operacional</h1>
        </div>

        <p className="max-w-3xl text-sm text-gray-500">
          Visao decision-grade da operacao de mentoria — alunos ativos, distribuicao por fase e gargalos. Read-only — abra o Hub Operacional para acoes pedagogicas.
        </p>

        {/* KPI strip */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label="Alunos ativos"
            value={formatNumber(totalActive)}
            helper={`${data.completedEnrollmentCount} concluidos historicamente`}
            icon={Users}
            tone="blue"
          />
          <KpiCard
            label="Matriculas pausadas"
            value={formatNumber(data.pausedEnrollmentCount)}
            helper="Status PAUSED na operacao"
            icon={AlertCircle}
            tone={data.pausedEnrollmentCount > 0 ? "amber" : "neutral"}
          />
          <KpiCard
            label="Sessoes (7 dias)"
            value={formatNumber(data.sessionsThisWeekCount)}
            helper="Sessoes registradas na semana"
            icon={Activity}
            tone="green"
          />
          <KpiCard
            label="Sem sessao 7d+"
            value={formatNumber(data.stuckStudents.length)}
            helper="Alunos ativos sem sessao recente"
            icon={Clock}
            tone={data.stuckStudents.length > 0 ? "red" : "neutral"}
          />
        </div>

        {/* Phase distribution table */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-gray-950">Distribuicao por fase</h2>
            <p className="text-sm text-gray-500">Alunos ativos por fase do programa — visao do funil pedagogico.</p>
          </header>
          {data.phaseRows.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Sem fases configuradas ou sem alunos ativos.
            </p>
          ) : (
            <div className="space-y-2">
              {data.phaseRows.map((row) => {
                const pct = totalActive > 0 ? (row.count / totalActive) * 100 : 0;
                return (
                  <div
                    key={row.label}
                    className="grid grid-cols-[1fr_120px_60px] items-center gap-3 rounded-md border border-gray-100 px-3 py-3"
                  >
                    <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                    <div className="h-2 w-full rounded-full bg-gray-100">
                      <div
                        className="h-2 rounded-full bg-brand-verde"
                        style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                      />
                    </div>
                    <p className="text-right text-sm font-semibold tabular-nums text-gray-900">
                      {formatNumber(row.count)}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Stuck students — top 5 by overdueness */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-red-600" />
            <div>
              <h2 className="text-lg font-semibold text-gray-950">Alunos sem sessao recente</h2>
              <p className="text-sm text-gray-500">Top 5 por dias sem sessao (7+) — risco de stagnacao pedagogica.</p>
            </div>
          </header>
          {data.stuckStudents.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Todos os alunos ativos tem sessao na ultima semana.
            </p>
          ) : (
            <div className="space-y-2">
              {data.stuckStudents.map((student) => (
                <div
                  key={student.enrollmentId}
                  className="rounded-md border border-red-100 bg-red-50/40 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="truncate text-sm font-semibold text-gray-950">{student.customerName}</p>
                      <p className="mt-1 text-xs text-gray-600">{student.customerEmail}</p>
                    </div>
                    <span className="rounded-md bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                      {student.lastSessionAt
                        ? `${student.overdueDays} dias`
                        : "Sem sessao registrada"}
                    </span>
                  </div>
                  {student.lastSessionAt && (
                    <p className="mt-1 text-xs text-gray-500">
                      Ultima sessao: {formatDateShort(student.lastSessionAt)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent phase transitions */}
        <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-gray-950">Transicoes recentes (7 dias)</h2>
            <p className="text-sm text-gray-500">Avancos de fase no programa — sinal de velocidade pedagogica.</p>
          </header>
          {data.recentTransitions.length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
              Sem transicoes de fase nos ultimos 7 dias.
            </p>
          ) : (
            <div className="space-y-2">
              {data.recentTransitions.map((t) => (
                <div
                  key={t.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-gray-100 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {t.enrollment.customer.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {t.fromPhase?.label ?? "Inicio"} → {t.toPhase.label}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{formatDateShort(t.createdAt)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
