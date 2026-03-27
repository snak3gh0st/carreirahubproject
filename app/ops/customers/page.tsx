import { Users } from "lucide-react";

export default function OpsCustomersPage() {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">
          Clientes
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Visao operacional dos clientes
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 px-8 bg-white rounded-2xl border border-gray-200">
        <Users className="h-12 w-12 text-brand-verde/30 mb-4" />
        <h2 className="text-lg font-display font-semibold text-brand-verde mb-2">
          Em construcao
        </h2>
        <p className="text-sm text-gray-400 text-center max-w-md">
          A lista de clientes com visao operacional sera adicionada quando os
          detalhes do fluxo operacional forem definidos.
        </p>
      </div>
    </div>
  );
}
