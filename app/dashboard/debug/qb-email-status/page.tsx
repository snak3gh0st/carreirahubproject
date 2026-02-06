"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import Link from "next/link";

export default function QBEmailStatusPage() {
  const { data: session, status } = useSession();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch("/api/debug/check-qb-email-status");
        if (res.ok) {
          const result = await res.json();
          setData(result);
        } else {
          setError("Falha ao buscar status");
        }
      } catch (err) {
        setError("Erro ao carregar status");
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      fetchStatus();
    }
  }, [session]);

  if (status === "loading") {
    return <div className="p-8">Carregando...</div>;
  }

  if (!session) {
    redirect("/auth/signin");
  }

  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "FINANCE") {
    redirect("/dashboard");
  }

  if (loading) {
    return <div className="p-8">Carregando status de email...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded p-4 text-red-800">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Status de Email do QuickBooks</h1>
        <p className="text-gray-600">
          Verificar se o QuickBooks está enviando emails de fatura para os clientes
        </p>
      </div>

      {/* Environment Status */}
      <div
        className={`mb-6 p-6 rounded-lg border-2 ${
          data.isSandbox
            ? "bg-orange-50 border-orange-300"
            : "bg-green-50 border-green-300"
        }`}
      >
        <h2 className="text-xl font-bold mb-2">
          {data.isSandbox ? "⚠️ MODO SANDBOX" : "✓ MODO PRODUÇÃO"}
        </h2>
        <p className="text-sm font-medium mb-2">
          Ambiente: <code className="bg-white px-2 py-1 rounded">{data.environment}</code>
        </p>
        {data.isSandbox && (
          <div className="bg-orange-100 border border-orange-300 rounded p-4 mt-3">
            <p className="font-bold text-orange-900 mb-2">
              {data.warning}
            </p>
            <p className="text-sm text-orange-800">
              Para enviar emails reais:
            </p>
            <ol className="text-sm text-orange-800 list-decimal list-inside mt-2 space-y-1">
              <li>Configure conta Production no QuickBooks</li>
              <li>
                Adicione <code className="bg-white px-1">QUICKBOOKS_ENVIRONMENT=production</code> no .env
              </li>
              <li>Reconecte OAuth em /api/quickbooks/auth/connect</li>
            </ol>
          </div>
        )}
      </div>

      {/* Email Statistics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-green-50 border border-green-200 p-6 rounded-lg">
          <h3 className="text-sm font-medium text-green-700">Emails Enviados</h3>
          <p className="text-4xl font-bold mt-2 text-green-900">
            {data.emailStats.sent}
          </p>
          <p className="text-sm text-green-600 mt-1">API calls bem-sucedidas</p>
        </div>
        <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
          <h3 className="text-sm font-medium text-red-700">Falhas de Email</h3>
          <p className="text-4xl font-bold mt-2 text-red-900">
            {data.emailStats.failed}
          </p>
          <p className="text-sm text-red-600 mt-1">Erros ao enviar</p>
        </div>
      </div>

      {/* Recent Email Logs */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">Logs Recentes de Email (últimos 20)</h2>
        </div>
        <div className="overflow-x-auto">
          {data.recentEmailLogs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhum log de email encontrado. Crie uma fatura para testar.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ação
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Detalhes
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.recentEmailLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.action === "invoice_email_sent"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          log.status === "SUCCESS"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.error && (
                        <div className="text-red-600 font-medium">{log.error}</div>
                      )}
                      {log.payload && (
                        <details className="cursor-pointer">
                          <summary className="text-blue-600 hover:underline">
                            Ver payload
                          </summary>
                          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-auto max-w-md">
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">Faturas Recentes (últimas 10)</h2>
        </div>
        <div className="overflow-x-auto">
          {data.recentInvoices.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              Nenhuma fatura encontrada no QuickBooks.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fatura #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    QB ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Email Cliente
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Valor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.recentInvoices.map((inv: any) => (
                  <tr key={inv.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">
                      <Link href={`/dashboard/invoices/${inv.id}`}>
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {inv.qbInvoiceId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {inv.customerEmail}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      ${Number(inv.amount).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {inv.status}
                        </span>
                        <span className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          {inv.approvalStatus}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <a
                        href={`/api/debug/test-qb-email?invoiceId=${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Testar Email
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-lg font-bold text-blue-900 mb-3">
          Como Verificar se Emails Estão Sendo Enviados
        </h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-900">
          <li>
            <strong>Verifique as estatísticas acima</strong> - Se "Emails Enviados" &gt; 0, a API foi chamada
          </li>
          <li>
            <strong>Modo Sandbox</strong> - Emails NÃO são enviados de verdade, apenas simulados
          </li>
          <li>
            <strong>Modo Production</strong> - Emails são enviados ao customer email cadastrado
          </li>
          <li>
            <strong>Teste manual</strong> - Clique em "Testar Email" em qualquer invoice acima
          </li>
          <li>
            <strong>Verifique logs</strong> - Erros aparecem na tabela "Logs Recentes de Email"
          </li>
        </ol>

        <div className="mt-4 pt-4 border-t border-blue-300">
          <p className="text-sm font-bold text-blue-900 mb-2">Links Úteis:</p>
          <div className="flex gap-4">
            <Link
              href="/dashboard/invoices/new"
              className="text-blue-600 hover:underline text-sm"
            >
              Criar Nova Fatura
            </Link>
            <Link
              href="/dashboard/invoices/approval-queue"
              className="text-blue-600 hover:underline text-sm"
            >
              Fila de Aprovação
            </Link>
            <a
              href="https://app.qbo.intuit.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline text-sm"
            >
              QuickBooks Dashboard
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
