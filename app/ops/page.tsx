import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import {
  KanbanSquare, GraduationCap, Users, BookOpen, ClipboardList,
  CalendarCheck, ArrowRight, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, UserCheck, Layers, FileText,
} from "lucide-react";

export default async function OpsHomePage() {
  const session = await getServerSession(authOptions);
  const userName = (session?.user as any)?.name?.split(" ")[0] || "User";

  const [
    totalActive,
    totalPaused,
    totalCompleted,
    phaseCounts,
    pendingForms,
    completedForms,
    dailyFlags,
    recentEnrollments,
  ] = await Promise.all([
    prisma.mentorshipEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.mentorshipEnrollment.count({ where: { status: "PAUSED" } }),
    prisma.mentorshipEnrollment.count({ where: { status: "COMPLETED" } }),
    prisma.mentorshipPhase.findMany({
      orderBy: { sortOrder: "asc" },
      select: { label: true, key: true, _count: { select: { enrollments: true } } },
    }),
    prisma.formAssignment.count({ where: { status: "PENDING" } }),
    prisma.formAssignment.count({ where: { status: "COMPLETED" } }),
    prisma.mentorshipEnrollment.count({
      where: {
        status: "ACTIVE",
        slaDeadline: { lte: new Date(Date.now() + 3 * 86400000) },
      },
    }),
    prisma.mentorshipEnrollment.findMany({
      where: { status: "ACTIVE" },
      orderBy: { startDate: "desc" },
      take: 5,
      include: {
        customer: { select: { name: true } },
        currentPhase: { select: { label: true } },
      },
    }),
  ]);

  const totalStudents = totalActive + totalPaused + totalCompleted;
  const withStudents = phaseCounts.filter((p) => p._count.enrollments > 0);
  const maxInPhase = Math.max(...phaseCounts.map((p) => p._count.enrollments), 1);

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-display font-bold text-brand-verde tracking-tight">
          Olá, {userName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Hub Operacional &mdash; {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      {/* Urgent Alert */}
      {dailyFlags > 0 && (
        <Link href="/ops/daily" className="block mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl hover:bg-red-100/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-red-600" />
            </div>
            <div className="flex-1">
              <p className="font-display font-semibold text-red-700">
                {dailyFlags} aluno{dailyFlags > 1 ? "s" : ""} precisa{dailyFlags > 1 ? "m" : ""} de atenção
              </p>
              <p className="text-xs text-red-600">SLA próximo do vencimento ou sem sessão recente</p>
            </div>
            <ArrowRight className="h-5 w-5 text-red-400" />
          </div>
        </Link>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-emerald-50 rounded-xl"><UserCheck className="h-5 w-5 text-emerald-600" /></div>
            <span className="text-sm font-medium text-gray-500">Ativos</span>
          </div>
          <p className="text-3xl font-display font-bold text-emerald-700 tabular-nums">{totalActive}</p>
          <p className="text-xs text-gray-400 mt-1">alunos em mentoria</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-blue-50 rounded-xl"><Layers className="h-5 w-5 text-blue-600" /></div>
            <span className="text-sm font-medium text-gray-500">Fases</span>
          </div>
          <p className="text-3xl font-display font-bold text-blue-700 tabular-nums">{withStudents.length}</p>
          <p className="text-xs text-gray-400 mt-1">de {phaseCounts.length} com alunos</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-amber-50 rounded-xl"><ClipboardList className="h-5 w-5 text-amber-600" /></div>
            <span className="text-sm font-medium text-gray-500">Formulários</span>
          </div>
          <p className="text-3xl font-display font-bold text-amber-700 tabular-nums">{pendingForms}</p>
          <p className="text-xs text-gray-400 mt-1">pendentes de resposta</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 bg-gray-100 rounded-xl"><TrendingUp className="h-5 w-5 text-gray-600" /></div>
            <span className="text-sm font-medium text-gray-500">Concluídos</span>
          </div>
          <p className="text-3xl font-display font-bold text-gray-900 tabular-nums">{totalCompleted}</p>
          <p className="text-xs text-gray-400 mt-1">{totalStudents > 0 ? `${Math.round((totalCompleted / totalStudents) * 100)}%` : "0%"} do total</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {[
          { href: "/ops/pipeline", icon: KanbanSquare, label: "Pipeline", primary: true },
          { href: "/ops/daily", icon: CalendarCheck, label: "Ações do Dia" },
          { href: "/ops/enroll", icon: GraduationCap, label: "Matricular" },
          { href: "/ops/customers", icon: Users, label: "Clientes" },
          { href: "/dashboard/forms", icon: ClipboardList, label: "Formulários" },
          { href: "/ops/handbook", icon: BookOpen, label: "Guia" },
        ].map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all text-center ${
                action.primary
                  ? "bg-brand-verde text-white hover:opacity-90 shadow-md"
                  : "bg-white border border-gray-100 text-gray-700 hover:border-brand-verde hover:shadow-sm"
              }`}
            >
              <Icon className={`h-5 w-5 ${action.primary ? "text-white" : "text-brand-verde"}`} />
              <span className="font-display font-semibold text-xs">{action.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Phase Distribution */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Distribuição por Fase</h2>
            <Link href="/ops/pipeline" className="text-xs font-medium text-brand-verde hover:text-brand-tangerina transition-colors flex items-center gap-1">
              Ver Pipeline <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {withStudents.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400">Nenhum aluno matriculado ainda</p>
            </div>
          ) : (
            <div className="p-6 space-y-3">
              {phaseCounts.map((phase) => {
                const count = phase._count.enrollments;
                const pct = (count / maxInPhase) * 100;
                return (
                  <div key={phase.key} className="flex items-center gap-4">
                    <span className="text-sm text-gray-700 w-36 truncate font-medium">{phase.label}</span>
                    <div className="flex-1 h-6 bg-gray-50 rounded-lg overflow-hidden">
                      {count > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-brand-verde to-brand-verde/70 rounded-lg flex items-center justify-end pr-2 transition-all"
                          style={{ width: `${Math.max(pct, 8)}%` }}
                        >
                          <span className="text-[11px] font-bold text-white">{count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Students */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Alunos Recentes</h2>
            <Link href="/ops/customers" className="text-xs font-medium text-brand-verde hover:text-brand-tangerina transition-colors flex items-center gap-1">
              Ver Todos <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentEnrollments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-400">Nenhum aluno ativo</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {recentEnrollments.map((e) => (
                <Link
                  key={e.id}
                  href={`/ops/students/${e.id}`}
                  className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="w-8 h-8 bg-brand-creme rounded-lg flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-bold text-brand-verde">
                      {e.customer.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{e.customer.name}</p>
                    <p className="text-xs text-gray-400">{e.currentPhase?.label || "—"}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Forms Summary */}
      {(pendingForms > 0 || completedForms > 0) && (
        <div className="mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-gray-400" />
              <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Formulários</h2>
            </div>
            <Link href="/dashboard/forms" className="text-xs font-medium text-brand-verde hover:text-brand-tangerina transition-colors flex items-center gap-1">
              Gerenciar <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-amber-50 rounded-xl">
              <p className="text-2xl font-bold text-amber-700">{pendingForms}</p>
              <p className="text-xs text-amber-600 font-medium">Pendentes</p>
            </div>
            <div className="text-center p-3 bg-emerald-50 rounded-xl">
              <p className="text-2xl font-bold text-emerald-700">{completedForms}</p>
              <p className="text-xs text-emerald-600 font-medium">Concluídos</p>
            </div>
            <Link href="/dashboard/forms/assign" className="flex flex-col items-center justify-center p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
              <ClipboardList className="h-5 w-5 text-brand-verde mb-1" />
              <p className="text-xs text-brand-verde font-semibold">Atribuir Novo</p>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
