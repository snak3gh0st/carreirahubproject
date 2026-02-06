"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = 'force-dynamic';

export default function BulkImportPage() {
  const router = useRouter();
  const [source, setSource] = useState<"PIPEDRIVE" | "QUICKBOOKS">("PIPEDRIVE");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pipedrive options
  const [importPersons, setImportPersons] = useState(true);
  const [importDeals, setImportDeals] = useState(true);

  // QuickBooks options
  const [importCustomers, setImportCustomers] = useState(true);
  const [importInvoices, setImportInvoices] = useState(true);
  const [importItems, setImportItems] = useState(false);

  const handleStartImport = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let endpoint = "";
      let body: any = {};

      if (source === "PIPEDRIVE") {
        if (!importPersons && !importDeals) {
          alert("Por favor, selecione pelo menos uma entidade para importar do Pipedrive");
          setIsLoading(false);
          return;
        }
        endpoint = "/api/integrations/bulk-import/pipedrive";
        body = { importPersons, importDeals };
      } else {
        if (!importCustomers && !importInvoices && !importItems) {
          alert("Por favor, selecione pelo menos uma entidade para importar do QuickBooks");
          setIsLoading(false);
          return;
        }
        endpoint = "/api/integrations/bulk-import/quickbooks";
        body = { importCustomers, importInvoices, importItems };
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao iniciar importação");
      }

      // Redirect to progress page
      router.push(`/dashboard/integrations/bulk-import/${data.importId}`);
    } catch (err) {
      console.error("Error starting import:", err);
      setError(err instanceof Error ? err.message : "Falha ao iniciar importação");
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Breadcrumb */}
      <div className="mb-4">
        <a href="/dashboard/integrations" className="text-blue-600 hover:underline text-sm">
          ← Voltar para Integrações
        </a>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Importação em Massa</h1>
        <p className="text-gray-600 mt-2">
          Importar dados existentes do Pipedrive ou QuickBooks para o Hub
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
          {error}
        </div>
      )}

      {/* Source Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">1. Selecione a Fonte</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setSource("PIPEDRIVE")}
            className={`p-6 border-2 rounded-lg transition ${
              source === "PIPEDRIVE"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            disabled={isLoading}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Pipedrive</h3>
              {source === "PIPEDRIVE" && (
                <span className="text-blue-600 text-2xl">✓</span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Importar contatos (pessoas) e negócios do Pipedrive CRM
            </p>
          </button>

          <button
            onClick={() => setSource("QUICKBOOKS")}
            className={`p-6 border-2 rounded-lg transition ${
              source === "QUICKBOOKS"
                ? "border-blue-600 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
            disabled={isLoading}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">QuickBooks</h3>
              {source === "QUICKBOOKS" && (
                <span className="text-blue-600 text-2xl">✓</span>
              )}
            </div>
            <p className="text-sm text-gray-600">
              Importar clientes, faturas e itens de serviço do QuickBooks
            </p>
          </button>
        </div>
      </div>

      {/* Entity Selection */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">2. Selecione as Entidades para Importar</h2>

        {source === "PIPEDRIVE" && (
          <div className="space-y-4">
            <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={importPersons}
                onChange={(e) => setImportPersons(e.target.checked)}
                className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <div>
                <div className="font-medium text-gray-900">Pessoas (Contatos)</div>
                <div className="text-sm text-gray-600">
                  Importar todas as pessoas do Pipedrive como clientes no Hub. Duplicatas serão
                  mescladas com base no email.
                </div>
              </div>
            </label>

            <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={importDeals}
                onChange={(e) => setImportDeals(e.target.checked)}
                className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <div>
                <div className="font-medium text-gray-900">Negócios</div>
                <div className="text-sm text-gray-600">
                  Importar todos os negócios do Pipedrive. Apenas negócios "ganhos" serão importados para manter
                  a qualidade dos dados.
                </div>
              </div>
            </label>
          </div>
        )}

        {source === "QUICKBOOKS" && (
          <div className="space-y-4">
            <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={importCustomers}
                onChange={(e) => setImportCustomers(e.target.checked)}
                className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <div>
                <div className="font-medium text-gray-900">Clientes</div>
                <div className="text-sm text-gray-600">
                  Importar todos os clientes do QuickBooks para o Hub. Duplicatas serão mescladas
                  com base no email.
                </div>
              </div>
            </label>

            <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={importInvoices}
                onChange={(e) => setImportInvoices(e.target.checked)}
                className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <div>
                <div className="font-medium text-gray-900">Faturas</div>
                <div className="text-sm text-gray-600">
                  Importar todas as faturas do QuickBooks. Estas serão automaticamente aprovadas pois
                  já existem no QuickBooks.
                </div>
              </div>
            </label>

            <label className="flex items-start p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={importItems}
                onChange={(e) => setImportItems(e.target.checked)}
                className="mt-1 mr-3 h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                disabled={isLoading}
              />
              <div>
                <div className="font-medium text-gray-900">Itens de Serviço</div>
                <div className="text-sm text-gray-600">
                  Importar itens de serviço/produtos do QuickBooks para uso na criação de faturas.
                </div>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
        <div className="flex items-start">
          <span className="text-2xl mr-3">⚠️</span>
          <div>
            <h3 className="font-semibold text-yellow-900 mb-2">Notas Importantes</h3>
            <ul className="text-sm text-yellow-800 space-y-1">
              <li>• Este processo pode levar vários minutos dependendo da quantidade de dados</li>
              <li>• Você pode acompanhar o progresso na próxima página</li>
              <li>• Registros existentes não serão duplicados (correspondidos por email)</li>
              <li>• A importação pode ser cancelada a qualquer momento</li>
              <li>• Um log de todos os registros importados estará disponível após a conclusão</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.push("/dashboard/integrations/sync-status")}
          disabled={isLoading}
        >
          Cancelar
        </Button>

        <Button
          variant="primary"
          size="lg"
          onClick={handleStartImport}
          isLoading={isLoading}
          leftIcon={
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          }
        >
          Iniciar Importação
        </Button>
      </div>
    </div>
  );
}
