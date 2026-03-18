import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";

type FormAssignmentStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

const statusConfig: Record<
  FormAssignmentStatus,
  { label: string; bg: string; text: string }
> = {
  PENDING: {
    label: "Pendente",
    bg: "bg-yellow-100",
    text: "text-yellow-800",
  },
  IN_PROGRESS: {
    label: "Em Andamento",
    bg: "bg-blue-100",
    text: "text-blue-800",
  },
  COMPLETED: {
    label: "Concluido",
    bg: "bg-green-100",
    text: "text-green-800",
  },
};

export default async function FormsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const assignments = await prisma.formAssignment.findMany({
    include: {
      customer: {
        select: { name: true, email: true },
      },
      submission: {
        select: { id: true },
      },
    },
    orderBy: { assignedAt: "desc" },
  });

  // Enrich with template title
  const enrichedAssignments = assignments.map((assignment) => {
    const template = FORM_TEMPLATES[assignment.templateId];
    return {
      ...assignment,
      templateTitle: template?.title ?? assignment.templateId,
    };
  });

  // Stats
  const totalAssignments = enrichedAssignments.length;
  const pendingCount = enrichedAssignments.filter(
    (a) => a.status === "PENDING"
  ).length;
  const inProgressCount = enrichedAssignments.filter(
    (a) => a.status === "IN_PROGRESS"
  ).length;
  const completedCount = enrichedAssignments.filter(
    (a) => a.status === "COMPLETED"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 md:p-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-display font-semibold text-gray-900">
              Formularios
            </h1>
            <p className="text-gray-600 mt-1">
              Gerencie formularios atribuidos aos clientes
            </p>
          </div>
          <Link
            href="/dashboard/forms/assign"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors shadow-sm hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <span className="hidden sm:inline">Atribuir Formulario</span>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm font-medium text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {totalAssignments}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm font-medium text-gray-500">Pendentes</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {pendingCount}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm font-medium text-gray-500">Em Andamento</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">
              {inProgressCount}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <p className="text-sm font-medium text-gray-500">Concluidos</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {completedCount}
            </p>
          </div>
        </div>

        {/* Assignments Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Formulario
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Data de Atribuicao
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                    Acoes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {enrichedAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center">
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                      <h3 className="mt-2 text-lg font-medium text-gray-900">
                        Nenhum formulario atribuido
                      </h3>
                      <p className="mt-1 text-sm text-gray-500">
                        Comece atribuindo um formulario a um cliente.
                      </p>
                      <Link
                        href="/dashboard/forms/assign"
                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Atribuir Formulario
                      </Link>
                    </td>
                  </tr>
                ) : (
                  enrichedAssignments.map((assignment) => {
                    const config = statusConfig[assignment.status];
                    return (
                      <tr
                        key={assignment.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-display font-medium text-gray-900">
                              {assignment.customer.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {assignment.customer.email}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-900">
                            {assignment.templateTitle}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex px-2.5 py-0.5 text-xs font-medium rounded-full ${config.bg} ${config.text}`}
                          >
                            {config.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 tabular-nums">
                          {new Date(assignment.assignedAt).toLocaleDateString(
                            "pt-BR",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {assignment.status === "COMPLETED" &&
                          assignment.submission ? (
                            <Link
                              href={`/dashboard/forms/submissions/${assignment.submission.id}`}
                              className="text-primary-600 hover:text-primary-700 font-medium"
                            >
                              Ver Resposta
                            </Link>
                          ) : (
                            <span className="text-gray-400">
                              Aguardando resposta
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
