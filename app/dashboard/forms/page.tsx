import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";
import {
  ClipboardList, Plus, CheckCircle2, Clock, Loader2, User, Mail,
  Calendar, Eye, ArrowRight, FileText,
} from "lucide-react";

type FormAssignmentStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

const statusConfig: Record<FormAssignmentStatus, { label: string; icon: typeof CheckCircle2; color: string; bg: string; border: string }> = {
  PENDING: { label: "Pendente", icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" },
  IN_PROGRESS: { label: "Em Andamento", icon: Loader2, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
  COMPLETED: { label: "Concluído", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" },
};

export default async function FormsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const assignments = await prisma.formAssignment.findMany({
    include: {
      customer: { select: { name: true, email: true } },
      submission: { select: { id: true, submittedAt: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  const enriched = assignments.map((a) => ({
    ...a,
    templateTitle: FORM_TEMPLATES[a.templateId]?.title ?? a.templateId,
    templateTitlePt: FORM_TEMPLATES[a.templateId]?.titlePt ?? a.templateId,
  }));

  const total = enriched.length;
  const pendingCount = enriched.filter((a) => a.status === "PENDING").length;
  const inProgressCount = enriched.filter((a) => a.status === "IN_PROGRESS").length;
  const completedCount = enriched.filter((a) => a.status === "COMPLETED").length;
  const completionRate = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto p-6 md:p-8 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold text-gray-900 tracking-tight">Formulários</h1>
            <p className="text-gray-500 mt-1">Gerencie formulários atribuídos aos clientes</p>
          </div>
          <Link
            href="/dashboard/forms/assign"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-primary-600 to-primary-700 text-white font-medium rounded-xl hover:from-primary-700 hover:to-primary-800 transition-all shadow-md shadow-primary-600/20 hover:shadow-lg hover:shadow-primary-600/30"
          >
            <Plus className="h-5 w-5" />
            <span className="hidden sm:inline">Atribuir Formulário</span>
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-gray-100 rounded-xl"><ClipboardList className="h-5 w-5 text-gray-600" /></div>
              <span className="text-sm font-medium text-gray-500">Total</span>
            </div>
            <p className="text-3xl font-display font-bold text-gray-900 tabular-nums">{total}</p>
            <p className="text-xs text-gray-400 mt-1">{completionRate}% taxa de conclusão</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-amber-50 rounded-xl"><Clock className="h-5 w-5 text-amber-600" /></div>
              <span className="text-sm font-medium text-gray-500">Pendentes</span>
            </div>
            <p className="text-3xl font-display font-bold text-amber-700 tabular-nums">{pendingCount}</p>
            <p className="text-xs text-gray-400 mt-1">aguardando preenchimento</p>
          </div>
          <div className="bg-white rounded-2xl border border-blue-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-blue-50 rounded-xl"><Loader2 className="h-5 w-5 text-blue-600" /></div>
              <span className="text-sm font-medium text-gray-500">Em Andamento</span>
            </div>
            <p className="text-3xl font-display font-bold text-blue-700 tabular-nums">{inProgressCount}</p>
            <p className="text-xs text-gray-400 mt-1">cliente está preenchendo</p>
          </div>
          <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-emerald-50 rounded-xl"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
              <span className="text-sm font-medium text-gray-500">Concluídos</span>
            </div>
            <p className="text-3xl font-display font-bold text-emerald-700 tabular-nums">{completedCount}</p>
            <p className="text-xs text-gray-400 mt-1">respostas recebidas</p>
          </div>
        </div>

        {/* List */}
        {enriched.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
            <div className="inline-flex p-4 bg-gray-50 rounded-2xl mb-4">
              <ClipboardList className="h-10 w-10 text-gray-300" />
            </div>
            <h3 className="text-lg font-display font-semibold text-gray-900 mb-1">Nenhum formulário atribuído</h3>
            <p className="text-sm text-gray-500 mb-6">Comece atribuindo um formulário a um cliente</p>
            <Link href="/dashboard/forms/assign" className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-700 transition-colors">
              <Plus className="h-4 w-4" /> Atribuir Formulário
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {enriched.map((assignment) => {
              const config = statusConfig[assignment.status as FormAssignmentStatus];
              const StatusIcon = config.icon;
              return (
                <div
                  key={assignment.id}
                  className="group bg-white rounded-xl border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all"
                >
                  <div className="flex items-center gap-4 p-4">
                    <div className={`flex-shrink-0 p-2.5 rounded-xl ${config.bg}`}>
                      <StatusIcon className={`h-5 w-5 ${config.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-display font-semibold text-gray-900 truncate">{assignment.customer.name}</span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${config.bg} ${config.color} border ${config.border}`}>
                          {config.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 flex items-center gap-3">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{assignment.customer.email}</span>
                        <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{assignment.templateTitle}</span>
                      </p>
                    </div>

                    <div className="hidden sm:block text-right min-w-[100px]">
                      <p className="text-sm text-gray-600 tabular-nums">
                        {new Date(assignment.assignedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                      {assignment.submission?.submittedAt && (
                        <p className="text-xs text-emerald-600 font-medium">
                          Respondido {new Date(assignment.submission.submittedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        </p>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {assignment.status === "COMPLETED" && assignment.submission ? (
                        <Link
                          href={`/dashboard/forms/submissions/${assignment.submission.id}`}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg hover:bg-emerald-100 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" /> Ver Resposta
                        </Link>
                      ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> Aguardando
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
