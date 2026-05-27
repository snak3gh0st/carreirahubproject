import { getServerSession } from "next-auth";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Clock,
  GraduationCap,
  ListChecks,
  MessageSquareText,
  PauseCircle,
  Sparkles,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDigisacStorageMissing } from "@/lib/ops/digisac-store";
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

  let digisacThreads: Array<{
    messages: Array<{ direction: string; createdAt: Date; externalCreatedAt: Date | null }>;
  }> = [];
  try {
    digisacThreads = await prisma.opsDigisacThread.findMany({
      where: { lastMessageAt: { not: null } },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
      select: {
        messages: {
          orderBy: [{ externalCreatedAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { direction: true, createdAt: true, externalCreatedAt: true },
        },
      },
    });
  } catch (error) {
    if (!isDigisacStorageMissing(error)) throw error;
  }

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
  const digisacNeedsReply = digisacThreads.filter((thread) => thread.messages[0]?.direction === "INBOUND").length;
  const attentionTotal = attentionRows.length;
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Boa madrugada";
    if (h < 12) return "Bom dia";
    if (h < 18) return "Boa tarde";
    return "Boa noite";
  })();

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-12 pt-8 md:px-8 md:pt-10">
      {/* Lead: greeting + the one line that matters */}
      <header className="mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
          {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-gray-900 md:text-[34px]">
          {greeting}, {userName}.
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-gray-600">
          {attentionTotal === 0 ? (
            <>Sem clientes em risco agora. Boa janela para ligar pra quem está há mais tempo sem sessão.</>
          ) : (
            <>
              <span className="font-semibold text-gray-900 tabular-nums">{attentionTotal}</span>{" "}
              {attentionTotal === 1 ? "cliente precisa" : "clientes precisam"} da sua atenção hoje
              {overdueCount > 0 && (
                <>
                  , <span className="font-semibold text-brand-tangerina tabular-nums">{overdueCount}</span> com SLA vencido
                </>
              )}
              {digisacNeedsReply > 0 && (
                <>
                  , <span className="font-semibold text-brand-tangerina tabular-nums">{digisacNeedsReply}</span> com mensagem nova no Digisac
                </>
              )}
              .
            </>
          )}
        </p>
      </header>

      {/* Action: priority list on the left, narrow status rail on the right */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <section>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold text-gray-900">
              Fila de atenção
              {attentionTotal > 0 && (
                <span className="ml-2 text-[13px] font-medium text-gray-400 tabular-nums">
                  {attentionTotal}
                </span>
              )}
            </h2>
            <Link
              href="/ops/pipeline"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-gray-500 transition hover:text-brand-verde"
            >
              Pipeline completo
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {attentionRows.length === 0 ? (
            <div className="rounded-xl border border-gray-200/60 bg-white px-8 py-16 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500" strokeWidth={1.75} />
              <p className="text-[15px] font-semibold text-gray-800">Tudo em dia.</p>
              <p className="mt-1.5 text-sm text-gray-500">
                Ninguém na operação exige ação imediata agora.
              </p>
            </div>
          ) : (
            <ul className="overflow-hidden rounded-xl border border-gray-200/60 bg-white">
              {attentionRows.map((row, idx) => {
                const isCritical = row.riskScore >= 40;
                return (
                  <li key={row.enrollment.id} className={idx === 0 ? "" : "border-t border-gray-100"}>
                    <Link
                      href={`/ops/students/${row.enrollment.id}`}
                      className="group flex items-center gap-3.5 px-4 py-3.5 transition hover:bg-gray-50 md:gap-4 md:px-5"
                    >
                      <div
                        aria-hidden
                        className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold tracking-wide ${
                          isCritical
                            ? "bg-orange-50 text-brand-tangerina ring-1 ring-orange-100"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {initials(row.enrollment.customer.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="truncate text-[14px] font-semibold text-gray-900">
                            {row.enrollment.customer.name}
                          </p>
                          <p className="hidden text-[12px] font-medium text-gray-400 md:block">
                            {row.phase?.label ?? "Sem fase"}
                          </p>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-gray-500">
                          {row.overdueSla && (
                            <span className="font-semibold text-brand-tangerina tabular-nums">
                              SLA +{row.phaseAgeDays - (row.phase?.slaDays ?? 0)}d
                            </span>
                          )}
                          {row.noRecentSession && (
                            <span className="tabular-nums">
                              {row.daysSinceLastSession === null
                                ? "sem sessão"
                                : `${row.daysSinceLastSession}d sem sessão`}
                            </span>
                          )}
                          {row.incompleteChecklist && (
                            <span className="tabular-nums">
                              checklist {row.checklistPercent}%
                            </span>
                          )}
                          {row.hasDebt && <span>débito pendente</span>}
                          {row.enrollment.assignedTo.name && (
                            <span className="hidden md:inline">
                              · {row.enrollment.assignedTo.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <ArrowRight
                        className="h-4 w-4 flex-shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-brand-verde"
                        strokeWidth={1.75}
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Right rail: situational stats + jump-offs */}
        <aside className="space-y-8">
          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              Estado da operação
            </h2>
            <dl className="space-y-3">
              <StatRow label="Na operação" value={rows.length} />
              <StatRow label="SLA vencido" value={overdueCount} accent={overdueCount > 0} />
              <StatRow label="Sem sessão recente" value={noSessionCount} accent={noSessionCount > 0} />
              <StatRow label="Sessões na semana" value={sessionsThisWeek} subtle />
              <StatRow label="Em pausa" value={pausedCount} subtle />
              <StatRow label="Formulários pend." value={pendingForms} subtle />
            </dl>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              Atalhos
            </h2>
            <ul className="space-y-1.5">
              <ShortcutRow href="/ops/digisac" label="Conversas Digisac" icon={MessageSquareText} badge={digisacNeedsReply} />
              <ShortcutRow href="/ops/ai" label="Pedir ao Assistente AI" icon={Sparkles} />
              <ShortcutRow href="/ops/enroll" label="Nova matrícula" icon={GraduationCap} />
              <ShortcutRow href="/ops/bi" label="Gargalos no BI" icon={BarChart3} />
              <ShortcutRow href="/ops/pipeline" label="Pipeline completo" icon={ListChecks} />
              <ShortcutRow href="/ops/handbook" label="Guia operacional" icon={BookOpen} />
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}

function StatRow({
  label,
  value,
  accent,
  subtle,
}: {
  label: string;
  value: number;
  accent?: boolean;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-gray-100 pb-2.5 last:border-b-0">
      <dt className={`text-[13px] ${subtle ? "text-gray-500" : "text-gray-700"}`}>{label}</dt>
      <dd
        className={`text-[18px] font-semibold tabular-nums leading-none ${
          accent && value > 0 ? "text-brand-tangerina" : subtle ? "text-gray-500" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function ShortcutRow({
  href,
  label,
  icon: Icon,
  badge,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-2.5 rounded-md px-2 py-2 text-[13px] font-medium text-gray-700 transition hover:bg-white hover:text-brand-verde"
      >
        <Icon className="h-4 w-4 flex-shrink-0 text-gray-400 transition group-hover:text-brand-verde" strokeWidth={1.75} />
        <span className="flex-1">{label}</span>
        {badge !== undefined && badge > 0 && (
          <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand-tangerina px-1 text-[10px] font-bold text-white tabular-nums">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        <ArrowRight
          className="h-3.5 w-3.5 text-gray-300 opacity-0 transition group-hover:translate-x-0.5 group-hover:text-brand-verde group-hover:opacity-100"
          strokeWidth={1.75}
        />
      </Link>
    </li>
  );
}
