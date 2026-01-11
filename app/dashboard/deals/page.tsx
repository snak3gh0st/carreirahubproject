import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealStatus } from "@prisma/client";
import Link from "next/link";

/**
 * Dashboard de Deals
 * 
 * Exibe lista de deals e pipeline de vendas
 */
export default async function DealsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Buscar deals
  const deals = await prisma.deal.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  // Pipeline por status
  const pipeline = await prisma.deal.groupBy({
    by: ["status"],
    _count: {
      id: true,
    },
  });

  const pipelineMap = pipeline.reduce(
    (acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    },
    {} as Record<DealStatus, number>
  );

  // Calcular valor total
  const totalValue = deals.reduce((sum, deal) => sum + Number(deal.value), 0);
  const wonValue = deals
    .filter((d) => d.status === DealStatus.WON)
    .reduce((sum, deal) => sum + Number(deal.value), 0);

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Deals & Pipeline</h1>

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Deals</h3>
          <p className="text-3xl font-bold mt-2">{deals.length}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Valor Total</h3>
          <p className="text-3xl font-bold mt-2">
            ${totalValue.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Deals Ganhos</h3>
          <p className="text-3xl font-bold mt-2">
            {pipelineMap.WON || 0}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Valor Ganho</h3>
          <p className="text-3xl font-bold mt-2">
            ${wonValue.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Abertos</h3>
          <p className="text-2xl font-bold mt-2">{pipelineMap.OPEN || 0}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Ganhos</h3>
          <p className="text-2xl font-bold mt-2 text-green-600">
            {pipelineMap.WON || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Perdidos</h3>
          <p className="text-2xl font-bold mt-2 text-red-600">
            {pipelineMap.LOST || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Em Espera</h3>
          <p className="text-2xl font-bold mt-2">{pipelineMap.HOLD || 0}</p>
        </div>
      </div>

      {/* Lista de Deals */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Título
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Valor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Owner
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Criado Em
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {deals.map((deal) => (
              <tr key={deal.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/dashboard/deals/${deal.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {deal.title}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {deal.customer ? (
                    <Link
                      href={`/dashboard/customers/${deal.customer.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {deal.customer.name}
                    </Link>
                  ) : (
                    <span className="text-gray-400">Sem cliente</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap font-medium">
                  {deal.currency} {Number(deal.value).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      deal.status === DealStatus.WON
                        ? "bg-green-100 text-green-800"
                        : deal.status === DealStatus.LOST
                        ? "bg-red-100 text-red-800"
                        : deal.status === DealStatus.HOLD
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {deal.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {deal.owner?.name || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(deal.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

