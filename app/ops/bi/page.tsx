import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";

export const dynamic = "force-dynamic";
export const metadata = { title: "BI Operacional | Ops Hub" };

function daysBetween(from: Date | string | null | undefined, to = new Date()) {
  if (!from) return null;
  return Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 86400000));
}

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

function pct(value: number) {
  return `${Math.round(value)}%`;
}

export default async function OpsBiPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const role = (session.user as any).role as string;
  if (!["ADMIN", "OPERATIONAL"].includes(role)) redirect("/ops");

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const [phases, pausedCount, completedCount, pendingForms, sessionsThisWeek] = await Promise.all([
    prisma.mentorshipPhase.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            customer: { select: { id: true, name: true, email: true, qbBalance: true } },
            assignedTo: { select: { id: true, name: true } },
            sessions: { orderBy: { sessionDate: "desc" }, take: 1, select: { sessionDate: true } },
            transitions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
            checklistProgress: {
              where: { completedAt: { not: null } },
              select: { phaseKey: true, itemKey: true, completedAt: true },
            },
            _count: { select: { sessions: true } },
          },
        },
      },
    }),
    prisma.mentorshipEnrollment.count({ where: { status: "PAUSED" } }),
    prisma.mentorshipEnrollment.count({ where: { status: "COMPLETED" } }),
    prisma.formAssignment.count({ where: { status: "PENDING" } }),
    prisma.mentorshipSession.count({ where: { sessionDate: { gte: weekStart } } }),
  ]);

  const rows = phases.flatMap((phase) =>
    phase.enrollments.map((enrollment) => {
      const phaseAgeDays = daysBetween(enrollment.transitions[0]?.createdAt ?? enrollment.startDate) ?? 0;
      const daysSinceLastSession = daysBetween(enrollment.sessions[0]?.sessionDate);
      const checklist = getPhaseChecklist(phase.key);
      const completedKeys = new Set(
        enrollment.checklistProgress
          .filter((item) => item.phaseKey === phase.key && item.completedAt)
          .map((item) => item.itemKey)
      );
      const completedChecklist = checklist.filter((item) => completedKeys.has(item.key)).length;
      const checklistPercent = checklist.length > 0 ? (completedChecklist / checklist.length) * 100 : 0;
      const debt = Number(enrollment.customer.qbBalance ?? 0);
      const overdueSla = phaseAgeDays > phase.slaDays;
      const staleSession = daysSinceLastSession === null || daysSinceLastSession >= 14;

      return {
        enrollment,
        phase,
        phaseAgeDays,
        daysSinceLastSession,
        checklistPercent,
        completedChecklist,
        totalChecklist: checklist.length,
        debt,
        riskScore:
          (overdueSla ? 40 : 0) +
          (staleSession ? 35 : 0) +
          (debt > 0 ? 15 : 0) +
          (checklist.length > 0 && checklistPercent < 50 ? 10 : 0),
        overdueSla,
        staleSession,
      };
    })
  );

  const activeCount = rows.length;
  const riskRows = rows.filter((row) => row.riskScore > 0).sort((a, b) => b.riskScore - a.riskScore);
  const debtRows = rows.filter((row) => row.debt > 0);
  const averageChecklist = activeCount > 0
    ? rows.reduce((sum, row) => sum + row.checklistPercent, 0) / activeCount
    : 0;
  const onTrackCount = rows.filter((row) => row.riskScore === 0).length;
  const maxPhaseCount = Math.max(...phases.map((phase) => phase.enrollments.length), 1);

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-3">
          <BarChart3 className="h-7 w-7 text-brand-verde" />
          <h1 className="text-3xl font-display font-bold text-brand-verde tracking-tight">
            BI Operacional
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Progresso, risco e gargalos de cada aluno ativo no fluxo operacional.
        </p>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Alunos ativos", value: activeCount, icon: UsersRound, color: "text-brand-verde", bg: "bg-brand-verde/10" },
          { label: "Em risco", value: riskRows.length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          { label: "Em dia", value: onTrackCount, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Checklist medio", value: pct(averageChecklist), icon: ClipboardList, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Sessoes semana", value: sessionsThisWeek, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${item.bg}`}>
                  <Icon className={`h-5 w-5 ${item.color}`} />
                </div>
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{item.label}</span>
              </div>
              <p className={`text-3xl font-display font-bold ${item.color}`}>{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Pausados</p>
          <p className="mt-2 text-2xl font-display font-bold text-orange-600">{pausedCount}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Concluidos</p>
          <p className="mt-2 text-2xl font-display font-bold text-gray-900">{completedCount}</p>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Formularios pendentes</p>
          <p className="mt-2 text-2xl font-display font-bold text-amber-600">{pendingForms}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-5 py-4">
            <h2 className="font-display text-base font-bold text-gray-900">Distribuicao por area/fase</h2>
            <p className="text-xs text-gray-400">Volume, SLA e progresso medio por fase.</p>
          </div>
          <div className="space-y-4 p-5">
            {phases.map((phase) => {
              const phaseRows = rows.filter((row) => row.phase.id === phase.id);
              const phaseAvg = phaseRows.length > 0
                ? phaseRows.reduce((sum, row) => sum + row.checklistPercent, 0) / phaseRows.length
                : 0;
              const phaseRisk = phaseRows.filter((row) => row.riskScore > 0).length;
              const width = Math.max((phase.enrollments.length / maxPhaseCount) * 100, phase.enrollments.length ? 8 : 0);

              return (
                <div key={phase.id}>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-800">{phase.label}</p>
                      <p className="text-xs text-gray-400">
                        {phase.enrollments.length} aluno{phase.enrollments.length !== 1 ? "s" : ""} · {phaseRisk} em risco · checklist {pct(phaseAvg)}
                      </p>
                    </div>
                    <span className="text-xs font-bold text-brand-verde">{phase.slaDays}d SLA</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-brand-verde" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-5 py-4">
            <h2 className="font-display text-base font-bold text-gray-900">Alunos que precisam de acao</h2>
            <p className="text-xs text-gray-400">Ordenado por risco operacional.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {riskRows.slice(0, 10).length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">Nenhum aluno em risco no momento.</div>
            ) : (
              riskRows.slice(0, 10).map((row) => (
                <Link
                  key={row.enrollment.id}
                  href={`/ops/students/${row.enrollment.id}`}
                  className="flex items-start gap-3 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-600">
                    {row.riskScore}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{row.enrollment.customer.name}</p>
                    <p className="text-xs text-gray-400">{row.phase.label} · {row.enrollment.assignedTo.name ?? "Sem responsavel"}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.overdueSla && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          SLA {row.phaseAgeDays}d
                        </span>
                      )}
                      {row.staleSession && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          {row.daysSinceLastSession === null ? "Sem sessao" : `${row.daysSinceLastSession}d sem sessao`}
                        </span>
                      )}
                      {row.debt > 0 && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                          {money(row.debt)}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-gray-300" />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-5 py-4">
            <h2 className="font-display text-base font-bold text-gray-900">Debitos que afetam operacao</h2>
            <p className="text-xs text-gray-400">Alunos ativos com saldo QuickBooks aberto.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {debtRows.slice(0, 8).length === 0 ? (
              <div className="p-10 text-center text-sm text-gray-400">Nenhum debito aberto em alunos ativos.</div>
            ) : (
              debtRows.slice(0, 8).map((row) => (
                <Link key={row.enrollment.id} href={`/ops/students/${row.enrollment.id}`} className="flex items-center gap-3 p-4 hover:bg-gray-50">
                  <WalletCards className="h-5 w-5 text-amber-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900">{row.enrollment.customer.name}</p>
                    <p className="text-xs text-gray-400">{row.phase.label}</p>
                  </div>
                  <span className="text-sm font-bold text-amber-700">{money(row.debt)}</span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-5 py-4">
            <h2 className="font-display text-base font-bold text-gray-900">Cadencia de sessoes</h2>
            <p className="text-xs text-gray-400">Alunos sem sessao recente por faixa.</p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3">
            {[
              { label: "Sem registro", value: rows.filter((row) => row.daysSinceLastSession === null).length },
              { label: "7+ dias", value: rows.filter((row) => (row.daysSinceLastSession ?? 0) >= 7).length },
              { label: "14+ dias", value: rows.filter((row) => (row.daysSinceLastSession ?? 0) >= 14 || row.daysSinceLastSession === null).length },
            ].map((item) => (
              <div key={item.label} className="rounded-lg bg-gray-50 p-4">
                <Clock className="mb-3 h-5 w-5 text-brand-verde" />
                <p className="text-2xl font-display font-bold text-gray-900">{item.value}</p>
                <p className="text-xs text-gray-400">{item.label}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
