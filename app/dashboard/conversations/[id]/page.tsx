import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { ConversationStatus, MessageRole } from "@prisma/client";
import Link from "next/link";

/**
 * Detalhes da Conversa
 * 
 * Exibe conversa completa com histórico de mensagens
 */
export default async function ConversationDetailPage({
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

  // Buscar conversa
  const conversation = await prisma.conversation.findUnique({
    where: { id: params.id },
    include: {
      lead: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          status: true,
          qualificationScore: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
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

  if (!conversation) {
    notFound();
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/conversations"
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Voltar para Conversas
        </Link>
        <h1 className="text-3xl font-bold">Conversa com {conversation.lead.name}</h1>
        <p className="text-gray-600 mt-2">
          {conversation.lead.email} • {conversation.lead.phone}
        </p>
      </div>

      {/* Informações do Lead */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Informações do Lead</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium">{conversation.lead.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Score de Qualificação</p>
            <p className="font-medium">
              {conversation.lead.qualificationScore !== null
                ? `${conversation.lead.qualificationScore}/100`
                : "Não qualificado"}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status da Conversa</p>
            <p className="font-medium">{conversation.status}</p>
          </div>
          {conversation.escalatedTo && (
            <div>
              <p className="text-sm text-gray-500">Escalado Para</p>
              <p className="font-medium">{conversation.escalatedTo.name}</p>
            </div>
          )}
        </div>
      </div>

      {/* Histórico de Mensagens */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Histórico de Mensagens</h2>
        <div className="space-y-4">
          {conversation.messages.map((message) => (
            <div
              key={message.id}
              className={`p-4 rounded-lg ${
                message.role === MessageRole.USER
                  ? "bg-blue-50 ml-8"
                  : "bg-gray-50 mr-8"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-sm">
                  {message.role === MessageRole.USER
                    ? conversation.lead.name
                    : "Assistente AI"}
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(message.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-gray-900">{message.content}</p>
              {message.metadata && (
                <div className="mt-2 text-xs text-gray-500">
                  <pre className="bg-white p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(message.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
