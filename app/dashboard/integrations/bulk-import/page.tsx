"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default function BulkImportPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importCustomers, setImportCustomers] = useState(true);
  const [importInvoices, setImportInvoices] = useState(true);
  const [importItems, setImportItems] = useState(false);

  const handleStartImport = async () => {
    if (!importCustomers && !importInvoices && !importItems) {
      alert("Por favor, selecione pelo menos uma entidade para importar do QuickBooks");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/integrations/bulk-import/quickbooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ importCustomers, importInvoices, importItems }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Falha ao iniciar importação");
      }

      router.push(`/dashboard/integrations/bulk-import/${data.importId}`);
    } catch (err) {
      console.error("Error starting import:", err);
      setError(err instanceof Error ? err.message : "Falha ao iniciar importação");
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <div className="mb-4">
        <a href="/dashboard/integrations" className="text-sm text-blue-600 hover:underline">
          Voltar para Integrações
        </a>
      </div>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">Importação em Massa</h1>
        <p className="mt-2 text-gray-600">
          Importar dados existentes do QuickBooks para o Hub.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Fonte</h2>
        <div className="rounded-lg border-2 border-blue-600 bg-blue-50 p-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg font-semibold">QuickBooks</h3>
            <span className="text-2xl text-blue-600">✓</span>
          </div>
          <p className="text-sm text-gray-600">
            Clint CRM não usa importação manual nesta tela. Ele sincroniza pelo cron diário e pelo endpoint de sync dedicado.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-xl font-semibold">Entidades para Importar</h2>
        <div className="space-y-4">
          <label className="flex cursor-pointer items-start rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={importCustomers}
              onChange={(event) => setImportCustomers(event.target.checked)}
              className="mr-3 mt-1 h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
              disabled={isLoading}
            />
            <div>
              <div className="font-medium text-gray-900">Clientes</div>
              <div className="text-sm text-gray-600">
                Importar todos os clientes do QuickBooks para o Hub. Duplicatas serão mescladas com base no email.
              </div>
            </div>
          </label>

          <label className="flex cursor-pointer items-start rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={importInvoices}
              onChange={(event) => setImportInvoices(event.target.checked)}
              className="mr-3 mt-1 h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
              disabled={isLoading}
            />
            <div>
              <div className="font-medium text-gray-900">Faturas</div>
              <div className="text-sm text-gray-600">
                Importar faturas do QuickBooks e marcar como aprovadas quando já existem oficialmente no QB.
              </div>
            </div>
          </label>

          <label className="flex cursor-pointer items-start rounded-lg border border-gray-200 p-4 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={importItems}
              onChange={(event) => setImportItems(event.target.checked)}
              className="mr-3 mt-1 h-5 w-5 rounded text-blue-600 focus:ring-blue-500"
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
      </div>

      <div className="mb-6 rounded-lg border border-yellow-200 bg-yellow-50 p-6">
        <h3 className="mb-2 font-semibold text-yellow-900">Notas Importantes</h3>
        <ul className="space-y-1 text-sm text-yellow-800">
          <li>Este processo pode levar vários minutos dependendo da quantidade de dados.</li>
          <li>Registros existentes não serão duplicados.</li>
          <li>O progresso fica disponível na próxima página.</li>
        </ul>
      </div>

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
        >
          Iniciar Importação
        </Button>
      </div>
    </div>
  );
}
