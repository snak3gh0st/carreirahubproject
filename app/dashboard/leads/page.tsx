import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import Link from "next/link";

const ITEMS_PER_PAGE = 25;

/**
 * Dashboard de Leads
 *
 * Exibe lista de leads e pipeline SDR com paginação
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verificar permissão
  const userRole = (session.user as any).role;
  if (userRole !== "ADMIN" && userRole !== "SDR" && userRole !== "SALES") {
    redirect("/dashboard");
  }

  const currentPage = Math.max(1, parseInt(searchParams.page || "1"));
  const skip = (currentPage - 1) * ITEMS_PER_PAGE;

  try {
    // Buscar leads com paginação
    const [leads, totalCount] = await Promise.all([
      prisma.lead.findMany({
        skip,
        take: ITEMS_PER_PAGE,
        orderBy: { createdAt: "desc" },
        include: {
          qualifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.lead.count(),
    ]);

    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

    // Pipeline por status
    const pipeline = await prisma.lead.groupBy({
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
      {} as Record<LeadStatus, number>
    );

    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Leads & SDR Pipeline</h1>

        {/* Pipeline Overview */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-8">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Novos</h3>
            <p className="text-2xl font-bold mt-2">{pipelineMap.NEW || 0}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Qualificando</h3>
            <p className="text-2xl font-bold mt-2">
              {pipelineMap.QUALIFYING || 0}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Qualificados</h3>
            <p className="text-2xl font-bold mt-2">
              {pipelineMap.QUALIFIED || 0}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">
              Não Qualificados
            </h3>
            <p className="text-2xl font-bold mt-2">
              {pipelineMap.UNQUALIFIED || 0}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Convertidos</h3>
            <p className="text-2xl font-bold mt-2">
              {pipelineMap.CONVERTED || 0}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-sm font-medium text-gray-500">Perdidos</h3>
            <p className="text-2xl font-bold mt-2">{pipelineMap.LOST || 0}</p>
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="mt-2 text-lg font-medium text-gray-900">
              No leads yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Leads will appear here when added via chatbot or webhook
            </p>
          </div>
        ) : (
          <>
            {/* Lista de Leads */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Nome
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Score
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Qualificado Por
                    </th>
                    <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Criado Em
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="md:hover:bg-gray-50 active:bg-gray-100 transition-colors">
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/leads/${lead.id}`}
                          className="text-blue-600 hover:underline"
                        >
                          {lead.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.email}
                      </td>
                      <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs rounded-full ${
                            lead.status === "QUALIFIED"
                              ? "bg-green-100 text-green-800"
                              : lead.status === "CONVERTED"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {lead.qualificationScore !== null
                          ? `${lead.qualificationScore}/100`
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.qualifiedBy?.name || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(lead.createdAt).toLocaleDateString()}
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
                  Page {currentPage} of {totalPages} ({totalCount} total leads)
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
                    Previous
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
                    Next
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  } catch (error) {
    console.error("Error fetching leads:", error);
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-3xl font-bold mb-6">Leads & SDR Pipeline</h1>
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
            Error loading leads
          </h3>
          <p className="mt-1 text-sm text-red-700">
            Unable to fetch leads data. Please try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
}

