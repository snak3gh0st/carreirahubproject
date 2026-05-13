import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { LeadStatus } from "@prisma/client";
import Link from "next/link";

/**
 * Detalhes do Lead
 *
 * Exibe informações completas do lead, conversas e histórico de qualificação
 */
export default async function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Verificar permissão
  const userRole = (session.user as any).role;
  if (
    userRole !== "ADMIN" &&
    userRole !== "COMMERCIAL" &&
    userRole !== "HEAD_COMERCIAL"
  ) {
    redirect("/dashboard");
  }

  // Buscar lead
  const lead = await prisma.lead.findUnique({
    where: { id: params.id },
    include: {
      conversations: {
        include: {
          messages: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
        },
        orderBy: { updatedAt: "desc" },
      },
      qualifications: {
        include: {
          qualifiedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      convertedToDeal: {
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      qualifiedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!lead) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/commercial/leads"
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Voltar para Leads
        </Link>
        <h1 className="text-3xl font-bold">{lead.name}</h1>
        <p className="text-gray-600 mt-2">{lead.email}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações Principais */}
        <div className="lg:col-span-2 space-y-6">
          {/* Informações do Lead */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Informações do Lead</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium mt-1">
                  <span
                    className={`px-2 py-1 text-xs rounded-full ${
                      lead.status === LeadStatus.QUALIFIED
                        ? "bg-green-100 text-green-800"
                        : lead.status === LeadStatus.CONVERTED
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {lead.status}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Fonte</p>
                <p className="font-medium mt-1">{lead.source}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Telefone</p>
                <p className="font-medium mt-1">{lead.phone || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Score de Qualificação</p>
                <p className="font-medium mt-1">
                  {lead.qualificationScore !== null
                    ? `${lead.qualificationScore}/100`
                    : "Não qualificado"}
                </p>
              </div>
              {lead.qualifiedBy && (
                <div>
                  <p className="text-sm text-gray-500">Qualificado Por</p>
                  <p className="font-medium mt-1">{lead.qualifiedBy.name}</p>
                </div>
              )}
              {lead.qualifiedAt && (
                <div>
                  <p className="text-sm text-gray-500">Qualificado Em</p>
                  <p className="font-medium mt-1">
                    {new Date(lead.qualifiedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Conversas */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Conversas</h2>
              <Link
                href={`/dashboard/conversations?leadId=${lead.id}`}
                className="text-blue-600 hover:underline text-sm"
              >
                Ver todas
              </Link>
            </div>
            {lead.conversations.length > 0 ? (
              <div className="space-y-4">
                {lead.conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/dashboard/conversations/${conversation.id}`}
                    className="block p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">
                          {conversation.title || "Conversa sem título"}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">
                          {conversation.messages.length} mensagens
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          conversation.status === "ESCALATED"
                            ? "bg-red-100 text-red-800"
                            : conversation.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {conversation.status}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhuma conversa ainda</p>
            )}
          </div>

          {/* Histórico de Qualificação */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              Histórico de Qualificação
            </h2>
            {lead.qualifications.length > 0 ? (
              <div className="space-y-4">
                {lead.qualifications.map((qualification) => (
                  <div
                    key={qualification.id}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">
                        Score: {qualification.score}/100
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(qualification.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {qualification.qualifiedBy && (
                      <p className="text-sm text-gray-500">
                        Por: {qualification.qualifiedBy.name}
                      </p>
                    )}
                    {qualification.notes && (
                      <p className="text-sm text-gray-700 mt-2">
                        {qualification.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">Nenhuma qualificação registrada</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Deal Convertido */}
          {lead.convertedToDeal && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Deal Convertido</h3>
              <Link
                href={`/dashboard/deals/${lead.convertedToDeal.id}`}
                className="text-blue-600 hover:underline"
              >
                {lead.convertedToDeal.title}
              </Link>
              <p className="text-sm text-gray-500 mt-2">
                Valor: {lead.convertedToDeal.currency}{" "}
                {Number(lead.convertedToDeal.value).toLocaleString()}
              </p>
              <p className="text-sm text-gray-500">
                Convertido em:{" "}
                {lead.convertedAt
                  ? new Date(lead.convertedAt).toLocaleDateString()
                  : "-"}
              </p>
            </div>
          )}

          {/* Ações Rápidas */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Ações</h3>
            <div className="space-y-2">
              {lead.status !== LeadStatus.QUALIFIED && (
                <form
                  action={`/api/leads/${lead.id}/qualify`}
                  method="POST"
                  className="w-full"
                >
                  <button
                    type="submit"
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                  >
                    Qualificar Lead
                  </button>
                </form>
              )}
              <Link
                href={`/dashboard/conversations?leadId=${lead.id}`}
                className="block w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition text-center"
              >
                Ver Conversas
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
