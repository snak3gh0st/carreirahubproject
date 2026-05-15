"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { StatusIndicator, StatusType } from "@/components/ui/status-indicator";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

interface SyncStatusData {
  clint: {
    lastSync: string | null;
    successRate: number;
    successCount: number;
    errorCount: number;
    total: number;
    status: StatusType;
  };
  quickbooks: {
    lastSync: string | null;
    isAuthenticated: boolean;
    successRate: number;
    successCount: number;
    errorCount: number;
    total: number;
    status: StatusType;
  };
  bulkImports: {
    running: number;
    completed: number;
    failed: number;
    cancelled: number;
  };
  recentErrors: Array<{
    id: string;
    service: string;
    action: string;
    error: string;
    createdAt: string;
  }>;
  timeframe: string;
}

export default function SyncStatusPage() {
  const [syncStatus, setSyncStatus] = useState<SyncStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch("/api/integrations/sync-status");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao carregar status de sincronização");
      }

      setSyncStatus(data.syncStatus);
      setIsLoading(false);
      setError(null);
    } catch (err) {
      console.error("Error fetching sync status:", err);
      setError(err instanceof Error ? err.message : "Falha ao carregar status de sincronização");
      setIsLoading(false);
    }
  };

  const triggerQuickBooksSync = async () => {
    setIsSyncing(true);
    setSyncResult(null);

    try {
      const response = await fetch("/api/quickbooks/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          syncCustomers: true,
          syncInvoices: true,
          syncPayments: false,
          maxResults: 5000, // Fetch up to 5000 records
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha na sincronização");
      }

      const customersCount = data.results?.customers?.total || 0;
      const invoicesCount = data.results?.invoices?.total || 0;

      setSyncResult(
        `✓ Sincronização concluída! Sincronizados ${customersCount} clientes e ${invoicesCount} faturas em ${Math.round(data.duration / 1000)}s`
      );

      // Refresh status after sync
      setTimeout(() => fetchSyncStatus(), 2000);
    } catch (err) {
      console.error("Error triggering sync:", err);
      setSyncResult(
        `✗ Falha na sincronização: ${err instanceof Error ? err.message : "Erro desconhecido"}`
      );
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchSyncStatus();

    if (autoRefresh) {
      const interval = setInterval(fetchSyncStatus, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <svg
              className="animate-spin h-12 w-12 text-blue-600 mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-gray-600">Carregando status de sincronização...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !syncStatus) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">Erro</h2>
          <p className="text-red-700">{error || "Falha ao carregar status de sincronização"}</p>
          <Button variant="primary" onClick={fetchSyncStatus} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const overallHealthy =
    syncStatus.clint.status === "healthy" &&
    syncStatus.quickbooks.status === "healthy";

  return (
    <div className="container mx-auto p-6">
      {/* Breadcrumb */}
      <div className="mb-4">
        <Link href="/dashboard/integrations" className="text-blue-600 hover:underline text-sm">
          ← Voltar para Integrações
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Status de Sincronização das Integrações</h1>
          <p className="text-gray-600 mt-1">
            Monitore a saúde das integrações QuickBooks e Clint CRM • {syncStatus.timeframe}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            Atualização automática (30s)
          </label>
          <Button variant="ghost" size="sm" onClick={fetchSyncStatus}>
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Atualizar
          </Button>
          <Button
            variant="primary"
            onClick={triggerQuickBooksSync}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Sincronizando...
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Sincronizar Agora
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Sync Result Notification */}
      {syncResult && (
        <div
          className={`rounded-lg p-4 mb-6 ${
            syncResult.startsWith("✓")
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
          }`}
        >
          <div className="flex items-center justify-between">
            <p
              className={`font-medium ${
                syncResult.startsWith("✓") ? "text-green-900" : "text-red-900"
              }`}
            >
              {syncResult}
            </p>
            <button
              onClick={() => setSyncResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-5 h-5"
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
            </button>
          </div>
        </div>
      )}

      {/* Overall Health Status */}
      <div
        className={`rounded-lg p-6 mb-6 ${
          overallHealthy
            ? "bg-green-50 border border-green-200"
            : "bg-yellow-50 border border-yellow-200"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">
              {overallHealthy ? "✓ Todos os Sistemas Operacionais" : "⚠️ Alguns Problemas Detectados"}
            </h2>
            <p
              className={`text-sm ${
                overallHealthy ? "text-green-700" : "text-yellow-700"
              }`}
            >
              {overallHealthy
                ? "Todas as integrações estão sincronizando com sucesso"
                : "Algumas integrações precisam de atenção"}
            </p>
          </div>
          <StatusIndicator
            status={overallHealthy ? "healthy" : "warning"}
            showDot={true}
          />
        </div>
      </div>

      {/* Integration Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Clint CRM Card */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">Clint CRM</h3>
              <StatusIndicator status={syncStatus.clint.status} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Taxa de Sucesso</div>
                <div className="text-2xl font-bold text-gray-900">
                  {syncStatus.clint.successRate}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total de Operações</div>
                <div className="text-2xl font-bold text-gray-900">
                  {syncStatus.clint.total}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sucesso</div>
                <div className="text-lg font-semibold text-green-600">
                  {syncStatus.clint.successCount}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Erros</div>
                <div className="text-lg font-semibold text-red-600">
                  {syncStatus.clint.errorCount}
                </div>
              </div>
            </div>

            {syncStatus.clint.lastSync && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">Última Sincronização</div>
                <div className="text-sm font-medium text-gray-900">
                  {new Date(syncStatus.clint.lastSync).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50">
            <Link
              href="/dashboard/settings/integrations?source=clint"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Configurar Clint →
            </Link>
          </div>
        </div>

        {/* QuickBooks Card */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold">QuickBooks</h3>
              <StatusIndicator status={syncStatus.quickbooks.status} />
            </div>

            {!syncStatus.quickbooks.isAuthenticated && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                ⚠️ QuickBooks não está autenticado. Por favor, reconecte.
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600">Taxa de Sucesso</div>
                <div className="text-2xl font-bold text-gray-900">
                  {syncStatus.quickbooks.successRate}%
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total de Operações</div>
                <div className="text-2xl font-bold text-gray-900">
                  {syncStatus.quickbooks.total}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Sucesso</div>
                <div className="text-lg font-semibold text-green-600">
                  {syncStatus.quickbooks.successCount}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Erros</div>
                <div className="text-lg font-semibold text-red-600">
                  {syncStatus.quickbooks.errorCount}
                </div>
              </div>
            </div>

            {syncStatus.quickbooks.lastSync && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600">Última Sincronização</div>
                <div className="text-sm font-medium text-gray-900">
                  {new Date(syncStatus.quickbooks.lastSync).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-50">
            <Link
              href="/dashboard/settings/integrations?source=quickbooks"
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Configurar QuickBooks →
            </Link>
          </div>
        </div>
      </div>

      {/* Bulk Import Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Importações em Massa</h3>
          <Link href="/dashboard/integrations/bulk-import">
            <Button variant="ghost" size="sm">
              Nova Importação →
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <div className="text-sm text-blue-700">Em Andamento</div>
            <div className="text-3xl font-bold text-blue-900">
              {syncStatus.bulkImports.running}
            </div>
          </div>
          <div className="p-4 bg-green-50 border border-green-200 rounded">
            <div className="text-sm text-green-700">Concluído</div>
            <div className="text-3xl font-bold text-green-900">
              {syncStatus.bulkImports.completed}
            </div>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded">
            <div className="text-sm text-red-700">Falhou</div>
            <div className="text-3xl font-bold text-red-900">
              {syncStatus.bulkImports.failed}
            </div>
          </div>
          <div className="p-4 bg-gray-50 border border-gray-200 rounded">
            <div className="text-sm text-gray-700">Cancelado</div>
            <div className="text-3xl font-bold text-gray-900">
              {syncStatus.bulkImports.cancelled}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Errors */}
      {syncStatus.recentErrors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-4">
            Erros Recentes ({syncStatus.recentErrors.length})
          </h3>

          <div className="space-y-3">
            {syncStatus.recentErrors.map((error) => (
              <div
                key={error.id}
                className="p-4 bg-red-50 border border-red-200 rounded-lg"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-red-900">
                        {error.service}
                      </span>
                      <span className="text-sm text-red-700">• {error.action}</span>
                    </div>
                    <div className="text-sm text-red-800">{error.error}</div>
                  </div>
                  <div className="text-xs text-red-600 whitespace-nowrap ml-4">
                    {new Date(error.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {syncStatus.recentErrors.length === 0 && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">✓</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Sem Erros Recentes
          </h3>
          <p className="text-gray-600">
            Todas as operações de sincronização foram concluídas com sucesso nas últimas 24 horas
          </p>
        </div>
      )}
    </div>
  );
}
