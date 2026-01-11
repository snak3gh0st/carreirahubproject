import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import Link from "next/link";

/**
 * Dashboard de Leads
 * 
 * Exibe lista de leads e pipeline SDR
 */
export default async function LeadsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verificar permissão
  const userRole = (session.user as any).role;
  if (
    userRole !== "ADMIN" &&
    userRole !== "SDR" &&
    userRole !== "SALES"
  ) {
    redirect("/dashboard");
  }

  // Buscar leads
  const leads = await prisma.lead.findMany({
    take: 50,
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
  });

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
          <p className="text-2xl font-bold mt-2">
            {pipelineMap.NEW || 0}
          </p>
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
          <p className="text-2xl font-bold mt-2">
            {pipelineMap.LOST || 0}
          </p>
        </div>
      </div>

      {/* Lista de Leads */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {leads.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-lg">Nenhum lead encontrado</p>
            <p className="text-gray-400 text-sm mt-2">
              Os leads aparecerão aqui quando forem criados
            </p>
          </div>
        ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Nome
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Qualificado Por
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Criado Em
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
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
                <td className="px-6 py-4 whitespace-nowrap">
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
        )}
      </div>
    </div>
  );
}

