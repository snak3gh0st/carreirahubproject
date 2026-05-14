import { getServerSession } from "next-auth";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  ListChecks,
  MessageSquareText,
  PauseCircle,
  UsersRound,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";
import { isOperationalManagerRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

function daysBetween(from: Date | string | null | undefined, to = new Date()) {
  if (!from) return null;
  return Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 86_400_000));
}

function initials(name: string) {
  return name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
}

export default async function OpsHomePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; name?: string | null; role?: string } | undefined;
  const userName = user?.name?.split(" ")[0] || "User";
  const role = user?.role ?? "";
  const userId = user?.id ?? "";

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const userRecord = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { assignedPhases: true } })
    : null;

  const phaseScope = isOperationalManagerRole(role)
    ? {}
    : { currentPhase: { key: { in: userRecord?.assignedPhases ?? [] } } };

  const [activeEnrollments, pausedCount, pendingForms, sessionsThisWeek] = await Promise.all([
    prisma.mentorshipEnrollment.findMany({
      where: { status: "ACTIVE", ...phaseScope },
      include: {
        customer: { select: { id: true, name: true, email: true, qbBalance: true } },
        currentPhase: { select: { id: true, key: true, label: true, slaDays: true } },
        assignedTo: { select: { id: true, name: true } },
        sessions: { orderBy: { sessionDate: "desc" }, take: 1, select: { sessionDate: true } },
        transitions: { orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
        checklistProgress: {
          where: { completedAt: { not: null } },
          select: { phaseKey: true, itemKey: true, completedAt: true },
        },
        _count: { select: { sessions: true } },
      },
    }),
    prisma.mentorshipEnrollment.count({ where: { status: "PAUSED" } }),
    prisma.formAssignment.count({ where: { status: "PENDING" } }),
    prisma.mentorshipSession.count({ where: { sessionDate: { gte: weekStart } } }),
  ]);

  const rows = activeEnrollments.map((enrollment) => {
    const phase = enrollment.currentPhase;
    const phaseAgeDays = daysBetween(enrollment.transitions[0]?.createdAt ?? enrollment.startDate) ?? 0;
    const daysSinceLastSession = daysBetween(enrollment.sessions[0]?.sessionDate);
    const checklist = getPhaseChecklist(phase?.key ?? "");
    const completedKeys = new Set(
      enrollment.checklistProgress
        .filter((item) => item.phaseKey === phase?.key && item.completedAt)
        .map((item) => item.itemKey)
    );
    const completedChecklist = checklist.filter((item) => completedKeys.has(item.key)).length;
    const checklistPercent = checklist.length > 0 ? Math.round((completedChecklist / checklist.length) * 100) : 0;
    const overdueSla = phase ? phaseAgeDays > phase.slaDays : false;
    const noRecentSession = daysSinceLastSession === null || daysSinceLastSession >= 14;
    const hasDebt = Number(enrollment.customer.qbBalance ?? 0) > 0;
    const incompleteChecklist = checklist.length > 0 && checklistPercent < 100;
    const riskScore =
      (overdueSla ? 40 : 0) +
      (noRecentSession ? 35 : 0) +
      (hasDebt ? 15 : 0) +
      (checklist.length > 0 && checklistPercent < 50 ? 10 : 0);

    return {
      enrollment,
      phase,
      phaseAgeDays,
      daysSinceLastSession,
      checklistPercent,
      completedChecklist,
      totalChecklist: checklist.length,
      overdueSla,
      noRecentSession,
      hasDebt,
      incompleteChecklist,
      riskScore,
    };
  });

  const attentionRows = rows
    .filter((row) => row.riskScore > 0 || row.incompleteChecklist)
    .sort((a, b) => b.riskScore - a.riskScore || a.checklistPercent - b.checklistPercent)
    .slice(0, 8);

  const overdueCount = rows.filter((row) => row.overdueSla).length;
  const noSessionCount = rows.filter((row) => row.noRecentSession).length;
  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-3">
            <CalendarDays className="h-7 w-7 text-brand-verde" />
            <h1 className="text-3xl font-display font-bold text-brand-verde tracking-tight">
              Hoje
            </h1>
          </div>
          <p className="text-sm text-gray-500">
            Olá, {userName}. A prioridade aqui é decidir quem precisa de ação agora.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/ops/pipeline" className="inline-flex items-center gap-2 rounded-lg bg-brand-verde px-4 py-2 text-sm font-semibold text-white">
            <ListChecks className="h-4 w-4" />
            Abrir alunos
          </Link>
          <Link href="/ops/enroll" className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:border-brand-verde hover:text-brand-verde">
            <GraduationCap className="h-4 w-4" />
            Nova matrícula
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Na operação", value: rows.length, icon: UsersRound, color: "text-brand-verde", bg: "bg-brand-verde/10" },
          { label: "SLA vencido", value: overdueCount, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
          { label: "Sem sessão", value: noSessionCount, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Sessões semana", value: sessionsThisWeek, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Formulários pend.", value: pendingForms, icon: MessageSquareText, color: "text-blue-600", bg: "bg-blue-50" },
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-5 py-4">
            <h2 className="font-display text-base font-bold text-gray-900">Fila de atenção</h2>
            <p className="text-xs text-gray-400">Alunos ordenados por risco, checklist e cadência.</p>
          </div>

          {attentionRows.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
              <p className="font-display font-semibold text-gray-700">Tudo em dia na sua operação.</p>
              <p className="mt-1 text-sm text-gray-400">Nenhum aluno exige ação imediata.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {attentionRows.map((row) => (
                <Link
                  key={row.enrollment.id}
                  href={`/ops/students/${row.enrollment.id}`}
                  className="flex items-start gap-4 p-4 transition-colors hover:bg-gray-50"
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                    row.riskScore > 40 ? "bg-red-50 text-red-600" : "bg-brand-creme text-brand-verde"
                  }`}>
                    {initials(row.enrollment.customer.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{row.enrollment.customer.name}</p>
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                        {row.phase?.label ?? "Sem fase"}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      {row.enrollment.assignedTo.name ?? "Sem responsável"} · {row.enrollment._count.sessions} sessão{row.enrollment._count.sessions !== 1 ? "ões" : ""}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.overdueSla && (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">
                          SLA {row.phaseAgeDays}d
                        </span>
                      )}
                      {row.noRecentSession && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                          {row.daysSinceLastSession === null ? "Sem sessão" : `${row.daysSinceLastSession}d sem sessão`}
                        </span>
                      )}
                      {row.incompleteChecklist && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          Checklist {row.checklistPercent}%
                        </span>
                      )}
                      {row.hasDebt && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                          Débito
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 flex-shrink-0 text-gray-300" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
            <h2 className="font-display text-base font-bold text-gray-900">Atalhos úteis</h2>
            <div className="mt-4 space-y-2">
              {[
                { href: "/ops/bi", label: "Ver gargalos no BI", icon: BarChart3 },
                { href: "/ops/handbook", label: "Guia operacional", icon: BookOpen },
                { href: "/dashboard/forms", label: "Gerenciar formulários", icon: ClipboardList },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-brand-verde hover:text-brand-verde"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-orange-100 bg-orange-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-orange-600" />
              <h2 className="font-display text-base font-bold text-orange-800">Pausados</h2>
            </div>
            <p className="text-3xl font-display font-bold text-orange-700">{pausedCount}</p>
            <p className="mt-1 text-xs text-orange-700/70">Validar retorno ou encerramento no acompanhamento.</p>
          </div>

          <div className="rounded-xl border border-amber-100 bg-amber-50 p-5">
            <div className="mb-3 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-amber-600" />
              <h2 className="font-display text-base font-bold text-amber-800">Formulários</h2>
            </div>
            <p className="text-3xl font-display font-bold text-amber-700">{pendingForms}</p>
            <p className="mt-1 text-xs text-amber-700/70">Pendentes na operação e no hub do aluno.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
