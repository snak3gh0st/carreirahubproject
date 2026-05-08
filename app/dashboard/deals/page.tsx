import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DealStatus } from "@prisma/client";
import Link from "next/link";

const ITEMS_PER_PAGE = 25;

/**
 * Dashboard de Deals
 *
 * Exibe lista de deals e pipeline de vendas com paginação
 */
export default async function DealsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const userRole = (session.user as any).role;
  const userId = (session.user as any).id as string;
  if (!["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"].includes(userRole)) {
    redirect("/dashboard");
  }

  const whereClause = userRole === "COMMERCIAL" ? { ownerId: userId } : {};
  const currentPage = Math.max(1, parseInt(searchParams.page || "1"));
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    // Buscar deals com paginação
    const [deals, totalCount] = await Promise.all([
      prisma.deal.findMany({
        where: whereClause,
        skip,
        take: ITEMS_PER_PAGE,
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
      }),
      prisma.deal.count({ where: whereClause }),
    ]);

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    // Pipeline por status
    const pipeline = await prisma.deal.groupBy({
      by: ["status"],
      where: whereClause,
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

    // Calcular valor total (todos os deals, não apenas da página)
    const allDealsValue = await prisma.deal.aggregate({
      where: whereClause,
      _sum: {
        value: true,
      },
    });

    const wonDealsValue = await prisma.deal.aggregate({
      _sum: {
        value: true,
      },
      where: {
        ...whereClause,
        status: DealStatus.WON,
      },
    });

    const totalValue = Number(allDealsValue._sum.value || 0);
    const wonValue = Number(wonDealsValue._sum.value || 0);

    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Deals & Pipeline</h1>

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Total de Deals</h3>
            <p className="text-3xl font-bold mt-2">{totalCount}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Valor Total</h3>
            <p className="text-3xl font-bold mt-2">
              ${totalValue.toLocaleString()}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Deals Ganhos</h3>
            <p className="text-3xl font-bold mt-2">{pipelineMap.WON || 0}</p>
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

        {/* Empty State */}
        {totalCount === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              Nenhum deal encontrado
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Crie seu primeiro deal ou ajuste seus filtros
            </p>
          </div>
        ) : (
          <>
            {/* Lista de Deals */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Título
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cliente
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Valor
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Responsável
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Criado Em
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {deals.map((deal) => (
                    <tr key={deal.id} className="md:hover:bg-gray-50 active:bg-gray-100 transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/deals/${deal.id}`}
                          className="text-blue-600 hover:underline font-medium"
                        >
                          {deal.title}
                        </Link>
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
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
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <p className="text-sm text-gray-700">
                  Página {currentPage} de {totalPages} ({totalCount} deals no total)
                </p>
                <div className="flex gap-2">
                  <Link
                    href={`?page=${currentPage - 1}`}
                    className={`px-4 py-2 rounded-md ${
                      currentPage === 1
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                    aria-disabled={currentPage === 1}
                  >
                    Anterior
                  </Link>
                  <Link
                    href={`?page=${currentPage + 1}`}
                    className={`px-4 py-2 rounded-md ${
                      currentPage === totalPages
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                    aria-disabled={currentPage === totalPages}
                  >
                    Próximo
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error("Error fetching deals:", error);
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Deals & Pipeline</h1>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-red-900">
            Erro ao carregar deals
          </h3>
          <p className="mt-1 text-sm text-red-700">
            Não foi possível buscar os dados dos deals. Tente novamente.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }
}
