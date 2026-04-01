import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { KanbanSquare, GraduationCap, Users } from "lucide-react";

export default async function OpsHomePage() {
  const session = await getServerSession(authOptions);
  const userName = (session?.user as any)?.name || "User";

  const [totalActive, phaseCounts] = await Promise.all([
    prisma.mentorshipEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.mentorshipPhase.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        label: true,
        key: true,
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  const withStudents = phaseCounts.filter((p) => p._count.enrollments > 0);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">Hub Operacional</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo, {userName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Alunos Ativos</p>
          <p className="text-3xl font-bold text-brand-verde">{totalActive}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Fases com Alunos</p>
          <p className="text-3xl font-bold text-brand-verde">{withStudents.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Total de Fases</p>
          <p className="text-3xl font-bold text-brand-verde">{phaseCounts.length}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        <Link
          href="/ops/pipeline"
          className="flex items-center gap-3 bg-brand-verde text-white rounded-xl px-5 py-4 hover:opacity-90 transition-opacity"
        >
          <KanbanSquare className="h-5 w-5 flex-shrink-0" />
          <span className="font-display font-semibold text-sm">Ver Pipeline</span>
        </Link>
        <Link
          href="/ops/enroll"
          className="flex items-center gap-3 bg-white border border-gray-200 text-brand-verde rounded-xl px-5 py-4 hover:border-brand-verde transition-colors"
        >
          <GraduationCap className="h-5 w-5 flex-shrink-0" />
          <span className="font-display font-semibold text-sm">Matricular Aluno</span>
        </Link>
        <Link
          href="/ops/customers"
          className="flex items-center gap-3 bg-white border border-gray-200 text-brand-verde rounded-xl px-5 py-4 hover:border-brand-verde transition-colors"
        >
          <Users className="h-5 w-5 flex-shrink-0" />
          <span className="font-display font-semibold text-sm">Ver Clientes</span>
        </Link>
      </div>

      {/* Phase breakdown */}
      {withStudents.length > 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-display font-semibold text-brand-verde text-sm">Distribuição por Fase</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {withStudents.map((phase) => (
              <div key={phase.key} className="px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-700">{phase.label}</span>
                <span className="text-sm font-semibold text-brand-verde">{phase._count.enrollments}</span>
              </div>
            ))}
          </div>
        </div>
      ) : phaseCounts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Nenhuma fase configurada ainda.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">Nenhum aluno matriculado. Use &ldquo;Matricular Aluno&rdquo; para começar.</p>
        </div>
      )}
    </div>
  );
}
