import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

/**
 * Integration Hub Dashboard
 *
 * Central view of all integrations (QuickBooks, Pipedrive, Stripe)
 * Shows connection status, sync statistics, and recent activity
 */
export default async function IntegrationHubPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verify permission (ADMIN or FINANCE)
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    redirect("/dashboard");
  }

  // Get system config
  const systemConfig = await prisma.systemConfig.findUnique({
    where: { id: "system" },
  });

  // Get sync statistics
  const [
    totalCustomers,
    qbCustomers,
    pipedriveCustomers,
    stripeCustomers,
    totalInvoices,
    qbInvoices,
    totalPayments,
    qbPayments,
    stripePayments,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.customer.count({ where: { quickbooks_id: { not: null } } }),
    prisma.customer.count({ where: { pipedrive_id: { not: null } } }),
    prisma.customer.count({ where: { stripe_id: { not: null } } }),
    prisma.invoice.count(),
    prisma.invoice.count({ where: { quickbooks_invoice_id: { not: null } } }),
    prisma.payment.count(),
    prisma.payment.count({ where: { quickbooks_payment_id: { not: null } } }),
    prisma.payment.count({ where: { stripe_payment_id: { not: null } } }),
  ]);

  // Get recent activity (last 15 integration events)
  const recentActivity = await prisma.integrationLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      service: true,
      action: true,
      status: true,
      error: true,
      createdAt: true,
    },
  });

  // Error statistics (last 24 hours)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const errorStats = await prisma.integrationLog.groupBy({
    by: ["service"],
    where: {
      status: "ERROR",
      createdAt: { gte: oneDayAgo },
    },
    _count: { id: true },
  });

  const errorsByService = errorStats.reduce(
    (acc, item) => {
      acc[item.service] = item._count.id;
      return acc;
    },
    {} as Record<string, number>
  );

  // QuickBooks status
  const qbConnected = systemConfig?.quickbooks_is_authenticated || false;
  const qbTokenValid =
    systemConfig?.quickbooks_token_expires_at &&
    new Date(systemConfig.quickbooks_token_expires_at) > new Date();

  // Pipedrive status
  const pipedriveConfigured = !!process.env.PIPEDRIVE_API_TOKEN;

  // Stripe status
  const stripeConfigured = !!process.env.STRIPE_SECRET_KEY;

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Hub de Integrações</h1>
          <p className="text-gray-600">
            Visão central de todas as integrações do sistema
          </p>
        </div>
        <Link
          href="/dashboard/integrations"
          className="text-blue-600 hover:underline"
        >
          Ver Todas as Integrações
        </Link>
      </div>

      {/* Connection Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* QuickBooks */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">QuickBooks</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                qbConnected && qbTokenValid
                  ? "bg-green-100 text-green-800"
                  : qbConnected
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {qbConnected && qbTokenValid
                ? "Conectado"
                : qbConnected
                  ? "Token Expirado"
                  : "Desconectado"}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">ID da Empresa:</span>
              <span className="font-medium">
                {systemConfig?.quickbooks_company_id || "N/A"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Última Sincronização:</span>
              <span className="font-medium">
                {systemConfig?.last_qb_sync
                  ? new Date(systemConfig.last_qb_sync).toLocaleString()
                  : "Nunca"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Token Expira:</span>
              <span className="font-medium">
                {systemConfig?.quickbooks_token_expires_at
                  ? new Date(
                      systemConfig.quickbooks_token_expires_at
                    ).toLocaleString()
                  : "N/A"}
              </span>
            </div>
            {errorsByService.QUICKBOOKS && (
              <div className="flex justify-between text-red-600">
                <span>Erros (24h):</span>
                <span className="font-medium">{errorsByService.QUICKBOOKS}</span>
              </div>
            )}
          </div>
          <div className="mt-4">
            {qbConnected ? (
              <Link
                href="/api/quickbooks/auth/connect"
                className="text-sm text-blue-600 hover:underline"
              >
                Reconectar
              </Link>
            ) : (
              <Link
                href="/api/quickbooks/auth/connect"
                className="text-sm text-blue-600 hover:underline"
              >
                Conectar Agora
              </Link>
            )}
          </div>
        </div>

        {/* Pipedrive */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pipedrive</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                pipedriveConfigured
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {pipedriveConfigured ? "Configurado" : "Não Configurado"}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Chave API:</span>
              <span className="font-medium">
                {pipedriveConfigured ? "Configurado" : "Ausente"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Segredo do Webhook:</span>
              <span className="font-medium">
                {systemConfig?.pipedrive_webhook_secret ||
                process.env.PIPEDRIVE_WEBHOOK_SECRET
                  ? "Configurado"
                  : "Ausente"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Última Sincronização:</span>
              <span className="font-medium">
                {systemConfig?.last_pipedrive_sync
                  ? new Date(systemConfig.last_pipedrive_sync).toLocaleString()
                  : "Nunca"}
              </span>
            </div>
            {errorsByService.PIPEDRIVE && (
              <div className="flex justify-between text-red-600">
                <span>Erros (24h):</span>
                <span className="font-medium">{errorsByService.PIPEDRIVE}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stripe */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Stripe</h3>
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium ${
                stripeConfigured
                  ? "bg-green-100 text-green-800"
                  : "bg-red-100 text-red-800"
              }`}
            >
              {stripeConfigured ? "Configurado" : "Não Configurado"}
            </span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Chave API:</span>
              <span className="font-medium">
                {stripeConfigured ? "Configurado" : "Ausente"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Segredo do Webhook:</span>
              <span className="font-medium">
                {process.env.STRIPE_WEBHOOK_SECRET ? "Configurado" : "Ausente"}
              </span>
            </div>
            {errorsByService.STRIPE && (
              <div className="flex justify-between text-red-600">
                <span>Erros (24h):</span>
                <span className="font-medium">{errorsByService.STRIPE}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sync Statistics */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Estatísticas de Sincronização
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Customers */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Clientes</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-semibold">{totalCustomers}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>QuickBooks:</span>
                <span className="font-medium">{qbCustomers}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>Pipedrive:</span>
                <span className="font-medium">{pipedriveCustomers}</span>
              </div>
              <div className="flex justify-between text-purple-600">
                <span>Stripe:</span>
                <span className="font-medium">{stripeCustomers}</span>
              </div>
            </div>
          </div>

          {/* Invoices */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Faturas</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-semibold">{totalInvoices}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>QuickBooks:</span>
                <span className="font-medium">{qbInvoices}</span>
              </div>
            </div>
          </div>

          {/* Payments */}
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">Pagamentos</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Total:</span>
                <span className="font-semibold">{totalPayments}</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>QuickBooks:</span>
                <span className="font-medium">{qbPayments}</span>
              </div>
              <div className="flex justify-between text-purple-600">
                <span>Stripe:</span>
                <span className="font-medium">{stripePayments}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Atividade Recente</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Horário
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Serviço
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Ação
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Erro
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentActivity.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    Nenhuma atividade recente
                  </td>
                </tr>
              ) : (
                recentActivity.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          log.service === "QUICKBOOKS"
                            ? "bg-green-100 text-green-800"
                            : log.service === "PIPEDRIVE"
                              ? "bg-blue-100 text-blue-800"
                              : log.service === "STRIPE"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {log.service}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.action.replace(/_/g, " ")}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          log.status === "SUCCESS"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                      {log.error || "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-6 py-4 border-t bg-gray-50">
          <Link
            href="/dashboard/integrations/logs"
            className="text-sm text-blue-600 hover:underline"
          >
            Ver Todos os Logs
          </Link>
        </div>
      </div>
    </div>
  );
}
