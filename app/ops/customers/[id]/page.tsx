import { Users } from "lucide-react";

export default function OpsCustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">
          Detalhe do Cliente
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Visao operacional — deliverables e acompanhamento
        </p>
      </div>

      <div className="flex flex-col items-center justify-center py-20 px-8 bg-white rounded-2xl border border-gray-200">
        <Users className="h-12 w-12 text-brand-verde/30 mb-4" />
        <h2 className="text-lg font-display font-semibold text-brand-verde mb-2">
          Em construcao
        </h2>
        <p className="text-sm text-gray-400 text-center max-w-md">
          O detalhe operacional do cliente sera adicionado quando os
          detalhes do fluxo operacional forem definidos.
        </p>
      </div>
    </div>
  );
}
