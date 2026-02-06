import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { WorkflowStatusBadge } from "@/components/dashboard/workflow-status-badge";

/**
 * Workflow Detail Page
 *
 * Shows complete workflow history for a deal with timeline view
 */
export default async function WorkflowDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Check permission
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    redirect("/dashboard");
  }

  // Fetch deal with all workflow related data
  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          status: true,
          amount: true,
          dueDate: true,
          createdAt: true,
          quickbooks_invoice_id: true,
        },
        orderBy: { createdAt: "desc" },
      },
      contracts: {
        select: {
          id: true,
          status: true,
          docusign_env_id: true,
          signedAt: true,
          createdAt: true,
          voidedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!deal) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Deal não encontrado</p>
        </div>
      </div>
    );
  }

  // Fetch integration logs related to this deal
  const integrationLogs = await prisma.integrationLog.findMany({
    where: {
      OR: [
        { payload: { path: ["dealId"], equals: deal.id } },
        {
          AND: deal.invoices.map((inv) => ({
            payload: { path: ["invoiceId"], equals: inv.id },
          })),
        },
        {
          AND: deal.contracts.map((contract) => ({
            payload: { path: ["contractId"], equals: contract.id },
          })),
        },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Build timeline events
  const timelineEvents: Array<{
    timestamp: Date;
    title: string;
    status: "success" | "error" | "pending";
    description?: string;
    link?: string;
  }> = [];

  // Deal Won event
  if (deal.workflowStartedAt) {
    timelineEvents.push({
      timestamp: deal.workflowStartedAt,
      title: "Deal Won",
      status: "success",
      description: `Workflow started for ${deal.title}`,
    });
  }

  // Invoice events
  deal.invoices.forEach((invoice) => {
    timelineEvents.push({
      timestamp: invoice.createdAt,
      title: "Fatura Criada",
      status: "success",
      description: `Invoice ${invoice.invoiceNumber || invoice.id.slice(0, 8)} - $${Number(invoice.amount).toFixed(2)}`,
      link: `/dashboard/invoices/${invoice.id}`,
    });
  });

  // Contract events
  deal.contracts.forEach((contract) => {
    timelineEvents.push({
      timestamp: contract.createdAt,
      title: "Contrato Enviado",
      status: "success",
      description: `DocuSign envelope: ${contract.docusign_env_id?.slice(0, 12) || "—"}`,
    });

    if (contract.signedAt) {
      timelineEvents.push({
        timestamp: contract.signedAt,
        title: "Contrato Assinado",
        status: "success",
        description: "Cliente completou a assinatura",
      });
    }

    if (contract.voidedAt) {
      timelineEvents.push({
        timestamp: contract.voidedAt,
        title: "Contrato Anulado",
        status: "error",
        description: "Contrato foi cancelado",
      });
    }
  });

  // Workflow completion
  if (deal.workflowCompletedAt) {
    timelineEvents.push({
      timestamp: deal.workflowCompletedAt,
      title: "Fluxo Concluído",
      status: "success",
      description: "Todas as etapas concluídas com sucesso",
    });
  }

  // Workflow error
  if (deal.workflowStatus === "FAILED" && deal.workflowError) {
    timelineEvents.push({
      timestamp: new Date(), // Use current time if no specific error timestamp
      title: "Fluxo Falhou",
      status: "error",
      description: deal.workflowError,
    });
  }

  // Sort timeline by timestamp DESC (most recent first)
  timelineEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/dashboard/workflows"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium mb-2 inline-block"
        >
          ← Voltar para Fluxos
        </Link>
        <h1 className="text-3xl font-bold text-gray-900">{deal.title}</h1>
        <p className="text-gray-600 mt-1">
          Deal value: ${Number(deal.value).toFixed(2)}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Timeline */}
        <div className="lg:col-span-2">
          {/* Workflow Status Card */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Status do Fluxo
            </h2>
            <div className="flex items-center gap-4">
              <WorkflowStatusBadge
                status={deal.workflowStatus}
                error={deal.workflowError}
              />
              {deal.workflowStartedAt && (
                <span className="text-sm text-gray-600">
                  Início: {new Date(deal.workflowStartedAt).toLocaleString()}
                </span>
              )}
              {deal.workflowCompletedAt && (
                <span className="text-sm text-gray-600">
                  Concluído: {new Date(deal.workflowCompletedAt).toLocaleString()}
                </span>
              )}
            </div>
            {deal.workflowError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-800 mb-1">Detalhes do Erro:</p>
                <p className="text-sm text-red-700">{deal.workflowError}</p>
              </div>
            )}
            {deal.workflowStatus === "FAILED" && (
              <form
                action={`/api/deals/${deal.id}/workflow/retry`}
                method="POST"
                className="mt-4"
              >
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                >
                  Tentar Novamente
                </button>
              </form>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Linha do Tempo do Fluxo
            </h2>
            <div className="space-y-4">
              {timelineEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-8">
                  Nenhum evento de fluxo ainda
                </p>
              ) : (
                timelineEvents.map((event, index) => (
                  <div key={index} className="flex gap-4">
                    <div className="flex-shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          event.status === "success"
                            ? "bg-green-100"
                            : event.status === "error"
                            ? "bg-red-100"
                            : "bg-gray-100"
                        }`}
                      >
                        {event.status === "success" ? (
                          <svg
                            className="w-6 h-6 text-green-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : event.status === "error" ? (
                          <svg
                            className="w-6 h-6 text-red-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-6 h-6 text-gray-600"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div className="flex-grow">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{event.title}</p>
                          {event.description && (
                            <p className="text-sm text-gray-600 mt-1">
                              {event.description}
                            </p>
                          )}
                          {event.link && (
                            <Link
                              href={event.link}
                              className="text-sm text-blue-600 hover:text-blue-800 mt-1 inline-block"
                            >
                              Ver Detalhes →
                            </Link>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {event.timestamp.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Sidebar - Summary */}
        <div className="space-y-6">
          {/* Customer Info */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cliente
            </h3>
            {deal.customer ? (
              <div className="space-y-2">
                <p className="font-medium text-gray-900">{deal.customer.name}</p>
                <p className="text-sm text-gray-600">{deal.customer.email}</p>
                {deal.customer.phone && (
                  <p className="text-sm text-gray-600">{deal.customer.phone}</p>
                )}
                <Link
                  href={`/dashboard/customers/${deal.customer.id}`}
                  className="text-sm text-blue-600 hover:text-blue-800 inline-block mt-2"
                >
                  Ver Cliente →
                </Link>
              </div>
            ) : (
              <p className="text-gray-500">Nenhum cliente vinculado</p>
            )}
          </div>

          {/* Invoices Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Faturas ({deal.invoices.length})
            </h3>
            {deal.invoices.length === 0 ? (
              <p className="text-gray-500">Nenhuma fatura criada ainda</p>
            ) : (
              <div className="space-y-3">
                {deal.invoices.map((invoice) => (
                  <div key={invoice.id} className="border-b pb-3 last:border-0">
                    <Link
                      href={`/dashboard/invoices/${invoice.id}`}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800"
                    >
                      {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                    </Link>
                    <p className="text-sm text-gray-600 mt-1">
                      ${Number(invoice.amount).toFixed(2)} - {invoice.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      Due: {new Date(invoice.dueDate).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contracts Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Contratos ({deal.contracts.length})
            </h3>
            {deal.contracts.length === 0 ? (
              <p className="text-gray-500">Nenhum contrato enviado ainda</p>
            ) : (
              <div className="space-y-3">
                {deal.contracts.map((contract) => (
                  <div key={contract.id} className="border-b pb-3 last:border-0">
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {contract.status.toLowerCase().replace(/_/g, " ")}
                    </p>
                    {contract.signedAt && (
                      <p className="text-xs text-gray-500 mt-1">
                        Signed: {new Date(contract.signedAt).toLocaleString()}
                      </p>
                    )}
                    {contract.docusign_env_id && (
                      <p className="text-xs text-gray-500 mt-1">
                        Envelope: {contract.docusign_env_id.slice(0, 12)}...
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
