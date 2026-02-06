"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-bold text-gray-900">
          Algo deu errado
        </h1>
        <p className="text-gray-600">
          {error.message || "Ocorreu um erro ao carregar o painel"}
        </p>
        <div className="space-x-4">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Tentar novamente
          </button>
          <a
            href="/"
            className="px-4 py-2 bg-gray-200"
          >
            Voltar ao início
          </a>
        </div>
        {error.digest && (
          <p className="text-xs text-gray-500">
            ID do Erro: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
