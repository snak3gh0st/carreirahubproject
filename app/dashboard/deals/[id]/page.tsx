import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { DealStatus } from "@prisma/client";
import Link from "next/link";

/**
 * Página de detalhe do Deal
 */
export default async function DealDetailPage({
  params,
}: {
  params: { id: string };
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

  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      convertedFromLead: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
        },
      },
      invoices: {
        orderBy: { createdAt: "desc" },
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
      contracts: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!deal) {
    notFound();
  }

  if (userRole === "COMMERCIAL" && deal.ownerId !== userId) {
    redirect("/dashboard");
  }

  const totalInvoices = deal.invoices.reduce(
    (sum, inv) => sum + Number(inv.amount),
    0
  );
  const paidInvoices = deal.invoices
    .filter((inv) => inv.status === "PAID")
    .reduce((sum, inv) => sum + Number(inv.amount), 0);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/deals"
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Voltar para Deals
        </Link>
        <h1 className="text-3xl font-bold mt-4">{deal.title}</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Informações Principais */}
        <div className="lg:col-span-2 space-y-6">
          {/* Status e Valor */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Informações do Deal</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span
                  className={`inline-block mt-1 px-3 py-1 text-sm rounded-full ${
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
              </div>
              <div>
                <p className="text-sm text-gray-600">Valor</p>
                <p className="text-2xl font-bold mt-1">
                  {deal.currency} {Number(deal.value).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Pipedrive ID</p>
                <p className="mt-1">{deal.clint_deal_id}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Criado em</p>
                <p className="mt-1">
                  {new Date(deal.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>
          </div>

          {/* Cliente */}
          {deal.customer && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Cliente</h2>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Nome:</span>{" "}
                  <Link
                    href={`/dashboard/customers/${deal.customer.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {deal.customer.name}
                  </Link>
                </p>
                <p>
                  <span className="font-medium">Email:</span> {deal.customer.email}
                </p>
                {deal.customer.phone && (
                  <p>
                    <span className="font-medium">Telefone:</span> {deal.customer.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Lead Convertido */}
          {deal.convertedFromLead && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Lead Convertido</h2>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Nome:</span>{" "}
                  <Link
                    href={`/dashboard/leads/${deal.convertedFromLead.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {deal.convertedFromLead.name}
                  </Link>
                </p>
                <p>
                  <span className="font-medium">Email:</span> {deal.convertedFromLead.email}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {deal.convertedFromLead.status}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Owner */}
          {deal.owner && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-2">Responsável</h3>
              <p className="text-gray-900">{deal.owner.name}</p>
              <p className="text-sm text-gray-600">{deal.owner.email}</p>
            </div>
          )}

          {/* Resumo Financeiro */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Resumo Financeiro</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Valor do Deal</span>
                <span className="font-medium">
                  {deal.currency} {Number(deal.value).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Invoices</span>
                <span className="font-medium">
                  {deal.currency} {totalInvoices.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Pago</span>
                <span className="font-medium text-green-600">
                  {deal.currency} {paidInvoices.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between border-t pt-3">
                <span className="font-semibold">Pendente</span>
                <span className="font-semibold text-red-600">
                  {deal.currency} {(totalInvoices - paidInvoices).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Invoices */}
          {deal.invoices.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold mb-4">Invoices ({deal.invoices.length})</h3>
              <div className="space-y-2">
                {deal.invoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="block p-2 hover:bg-gray-50 rounded"
                  >
                    <p className="font-medium text-sm">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-gray-600">
                      {deal.currency} {Number(invoice.amount).toLocaleString()} - {invoice.status}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

