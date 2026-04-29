import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ConversationStatus } from "@prisma/client";
import Link from "next/link";

/**
 * Dashboard de Conversas
 * 
 * Exibe lista de conversas ativas e escaladas
 */
export default async function ConversationsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verificar permissão
  const userRole = (session.user as any).role;
  if (
    userRole !== "ADMIN" &&
    userRole !== "COMMERCIAL"
  ) {
    redirect("/dashboard");
  }

  // Buscar conversas
  const conversations = await prisma.conversation.findMany({
    take: 50,
    orderBy: { updatedAt: "desc" },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
        },
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      escalatedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Estatísticas
  const stats = await prisma.conversation.groupBy({
    by: ["status"],
    _count: {
      id: true,
    },
  });

  const statsMap = stats.reduce(
    (acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    },
    {} as Record<ConversationStatus, number>
  );

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Conversas & Customer Service</h1>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Ativas</h3>
          <p className="text-2xl font-bold mt-2">
            {statsMap.ACTIVE || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Escaladas</h3>
          <p className="text-2xl font-bold mt-2">
            {statsMap.ESCALATED || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Resolvidas</h3>
          <p className="text-2xl font-bold mt-2">
            {statsMap.RESOLVED || 0}
          </p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Fechadas</h3>
          <p className="text-2xl font-bold mt-2">
            {statsMap.CLOSED || 0}
          </p>
        </div>
      </div>

      {/* Lista de Conversas */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Lead
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Última Mensagem
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Escalado Para
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Atualizado
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {conversations.map((conversation) => (
              <tr key={conversation.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link
                    href={`/dashboard/conversations/${conversation.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {conversation.lead.name}
                  </Link>
                  <p className="text-sm text-gray-500">{conversation.lead.email}</p>
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900 truncate max-w-xs">
                    {conversation.messages[0]?.content || "Sem mensagens"}
                  </p>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      conversation.status === ConversationStatus.ESCALATED
                        ? "bg-red-100 text-red-800"
                        : conversation.status === ConversationStatus.ACTIVE
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {conversation.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {conversation.escalatedTo?.name || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(conversation.updatedAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

