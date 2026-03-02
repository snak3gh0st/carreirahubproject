import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus, ContractStatus } from "@prisma/client";
import Link from "next/link";
import { WorkflowTimeline } from "@/components/invoices/workflow-timeline";
import { ContractStatusCard } from "@/components/invoices/contract-status-card";
import { PaymentStatusCard } from "@/components/invoices/payment-status-card";
import { CollectionCallButton } from "@/components/invoices/collection-call-button";
import { CollectionCallHistory } from "@/components/invoices/collection-call-history";
import { DeleteInvoiceButton } from "@/components/invoices/delete-invoice-button";
import { Badge } from "@/components/ui/badge";
import { normalizeDateOnly, differenceInCalendarDaysUTC } from "@/lib/utils/date";
import { Edit, Download, ArrowLeft, FileText, DollarSign, Calendar } from "lucide-react";

function getStatusVariant(status: InvoiceStatus): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "PAID": return "success";
    case "SENT": return "info";
    case "OVERDUE": return "error";
    case "PARTIALLY_PAID": return "warning";
    default: return "default";
  }
}

/**
 * Invoice Detail Page with full workflow status
 */
export default async function InvoiceDetailPage({
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
  if (userRole !== "ADMIN" && userRole !== "FINANCE" && userRole !== "COMMERCIAL" && userRole !== "SALES") {
    redirect("/dashboard");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      deal: {
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
      },
      contract: true,
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  // Authorization: Check ownership for COMMERCIAL and SALES
  const userId = (session.user as any).id;
  if (userRole === "COMMERCIAL" || userRole === "SALES") {
    if (invoice.ownerId !== userId) {
      redirect("/dashboard");
    }
  }

  const dueDateOnly = normalizeDateOnly(invoice.dueDate);
  const overdueDays = differenceInCalendarDaysUTC(new Date(), dueDateOnly);
  const isOverdue =
    invoice.status === InvoiceStatus.OVERDUE ||
    (invoice.status === InvoiceStatus.SENT && overdueDays > 0);

  // Check if user can approve
  const canApprove = userRole === "FINANCE" || userRole === "ADMIN";

  // Check if user can edit
  const canEdit = (
    userRole === "ADMIN" || 
    userRole === "FINANCE" || 
    (["COMMERCIAL", "SALES"].includes(userRole) && invoice.ownerId === userId)
  ) && invoice.status !== InvoiceStatus.PAID && invoice.status !== InvoiceStatus.VOID;

  const businessTimeZone = "America/Sao_Paulo";

  // Build workflow steps
  const workflowSteps = [
    {
      title: "Fatura Criada",
      status: "completed" as const,
      date: invoice.createdAt,
      description: `Criada por ${invoice.deal?.owner?.name || "Sistema"}`,
    },
    {
      title: "Sincronização QuickBooks",
      status: invoice.quickbooks_invoice_id ? ("completed" as const) : ("current" as const),
      date: invoice.quickbooks_invoice_id ? invoice.createdAt : null,
      description: invoice.quickbooks_invoice_id
        ? `Sincronizado com QuickBooks (ID: ${invoice.quickbooks_invoice_id})`
        : "Sincronizando com QuickBooks...",
    },
    {
      title: "E-mail Enviado",
      status: invoice.emailSentAt
        ? ("completed" as const)
        : invoice.lastEmailSendError
        ? ("failed" as const)
        : ("pending" as const),
      date: invoice.emailSentAt,
      description: invoice.emailSentAt
        ? `E-mail enviado para ${invoice.customer.email} (${invoice.emailSendAttempts || 1} tentativa${(invoice.emailSendAttempts || 1) > 1 ? 's' : ''})`
        : invoice.lastEmailSendError
        ? `Falha ao enviar: ${invoice.lastEmailSendError} (${invoice.emailSendAttempts || 0} tentativa${(invoice.emailSendAttempts || 0) !== 1 ? 's' : ''})`
        : "O e-mail será enviado automaticamente",
    },
    {
      title: "Contrato Enviado",
      status: invoice.contract
        ? invoice.contract.status === ContractStatus.DECLINED ||
          invoice.contract.status === ContractStatus.EXPIRED
          ? ("failed" as const)
          : ("completed" as const)
        : ("pending" as const),
      date: invoice.contract?.sentAt,
      description: invoice.contract
        ? `Enviado para ${invoice.contract.signerEmail}`
        : "O contrato será gerado automaticamente",
    },
    {
      title: "Contrato Assinado",
      status:
        invoice.contract?.status === ContractStatus.SIGNED
          ? ("completed" as const)
          : invoice.contract?.status === ContractStatus.DECLINED
          ? ("failed" as const)
          : invoice.contract?.status === ContractStatus.SENT_FOR_SIGNATURE
          ? ("current" as const)
          : ("pending" as const),
      date: invoice.contract?.signedAt,
      description:
        invoice.contract?.status === ContractStatus.SIGNED
          ? "Cliente assinou o contrato"
          : invoice.contract?.status === ContractStatus.DECLINED
          ? "Cliente recusou assinar"
          : invoice.contract?.status === ContractStatus.EXPIRED
          ? "Contrato expirado"
          : invoice.contract?.status === ContractStatus.SENT_FOR_SIGNATURE
          ? `Aguardando assinatura (${invoice.contract?.reminderCount || 0} lembretes enviados)`
          : "Aguardando assinatura do contrato",
    },
    {
      title: "Link de Pagamento Enviado",
      status:
        invoice.stripePaymentLinkId
          ? ("completed" as const)
          : invoice.contract?.status === ContractStatus.SIGNED
          ? ("current" as const)
          : ("pending" as const),
      date: invoice.stripePaymentLinkId ? invoice.updatedAt : null,
      description: invoice.stripePaymentLinkId
        ? "Link de pagamento enviado ao cliente"
        : invoice.contract?.status === ContractStatus.SIGNED
        ? "Gerando link de pagamento..."
        : "O link de pagamento será enviado após a assinatura do contrato",
    },
    {
      title: "Pagamento Recebido",
      status:
        invoice.status === InvoiceStatus.PAID
          ? ("completed" as const)
          : invoice.stripePaymentLinkId
          ? ("current" as const)
          : ("pending" as const),
      date: invoice.paidAt,
      description:
        invoice.status === InvoiceStatus.PAID
          ? `Pago via ${invoice.paymentMethod || "Stripe"}`
          : invoice.stripePaymentLinkId
          ? `Aguardando pagamento (${invoice.paymentReminderCount || 0} lembretes enviados)`
          : "Aguardando pagamento",
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 md:p-8 max-w-7xl space-y-6">
        {/* Breadcrumb */}
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-sm">
            <li>
              <Link href="/dashboard/invoices" className="text-gray-500 hover:text-gray-700 font-display">
                Faturas
              </Link>
            </li>
            <li className="text-gray-400">›</li>
            <li className="text-gray-900 font-display font-medium">
              {invoice.invoiceNumber || `INV-${invoice.id.slice(0, 8)}`}
            </li>
          </ol>
        </nav>

        {/* Page Header with Status and Actions */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-display font-semibold text-gray-900 mb-2">
                Fatura #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
              </h1>
              <Badge variant={getStatusVariant(invoice.status)}>
                {invoice.status}
                {isOverdue && invoice.status !== InvoiceStatus.PAID && " (Vencida)"}
              </Badge>
            </div>
            <div className="flex items-center gap-3">
              {canEdit ? (
                <Link
                  href={`/dashboard/invoices/${invoice.id}/edit`}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-primary-600 text-white text-sm font-display font-semibold rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Editar Fatura
                </Link>
              ) : (
                <button
                  disabled
                  title={
                    invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID
                      ? `Não é possível editar faturas ${String(invoice.status).toLowerCase()}`
                      : "Você não tem permissão para editar esta fatura"
                  }
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gray-300 text-gray-500 text-sm font-display font-semibold rounded-lg cursor-not-allowed opacity-60"
                >
                  <Edit className="w-4 h-4" />
                  Editar Fatura
                </button>
              )}

              {invoice.pdfUrl && (
                <a
                  href={invoice.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-display font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Baixar PDF
                </a>
              )}
              
              <DeleteInvoiceButton
                invoiceId={invoice.id}
                invoiceNumber={invoice.invoiceNumber || invoice.id.slice(0, 8)}
                hasQuickbooksId={!!invoice.quickbooks_invoice_id}
                userRole={userRole}
              />
            </div>
          </div>
        </div>

        {/* Key Financial Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Amount Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-display font-medium text-gray-500 uppercase tracking-wide">Valor Total</p>
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-4xl font-bold text-gray-900 tabular-nums">
              {Number(invoice.amount).toLocaleString("en-US", {
                style: "currency",
                currency: "USD",
              })}
            </p>
          </div>

          {/* Due Date Card */}
          <div className={`bg-white border rounded-lg p-6 ${
            isOverdue && invoice.status !== InvoiceStatus.PAID ? "border-error-500 bg-error-50" : "border-gray-200"
          }`}>
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-display font-medium text-gray-500 uppercase tracking-wide">Data de Vencimento</p>
              <Calendar className="h-5 w-5 text-gray-400" />
            </div>
            <p className={`text-3xl font-bold tabular-nums ${
              isOverdue && invoice.status !== InvoiceStatus.PAID ? "text-error-600" : "text-gray-900"
            }`}>
              {dueDateOnly.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </p>
            {isOverdue && invoice.status !== InvoiceStatus.PAID && (
              <p className="text-sm font-semibold text-error-600 mt-2">
                Vencida há {overdueDays} dias
              </p>
            )}
          </div>

          {/* Data de Criação Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-display font-medium text-gray-500 uppercase tracking-wide">Data de Criação</p>
              <FileText className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-3xl font-bold text-gray-900 tabular-nums">
              {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                timeZone: businessTimeZone,
              })}
            </p>
          </div>
        </div>

        {/* Workflow Timeline */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-display font-semibold text-gray-900 mb-6">Progresso do Fluxo</h2>
          <WorkflowTimeline steps={workflowSteps} />
        </div>

        {/* Main Content: Two-Column Layout (Invoice Details + Customer Info) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Invoice Details */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-display font-semibold text-gray-900 mb-6">Detalhes da Fatura</h2>
          <div className="space-y-6">
            {/* Basic Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Número da Fatura</p>
                <p className="text-base font-semibold text-gray-900">
                  {invoice.invoiceNumber || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Data de Criação</p>
                <p className="text-base text-gray-900">
                  {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    timeZone: businessTimeZone,
                  })}
                </p>
              </div>
            </div>

            {/* Payment Info */}
            {invoice.paidAt && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-2">Informações de Pagamento</p>
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <p className="text-sm font-semibold text-green-800">Pagamento Recebido</p>
                  </div>
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Data:</span>{" "}
                    {new Date(invoice.paidAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                      timeZone: businessTimeZone,
                    })}
                  </p>
                  {invoice.paymentMethod && (
                    <p className="text-sm text-green-700">
                      <span className="font-medium">Método:</span> {invoice.paymentMethod}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* External IDs */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-600 mb-3">IDs de Sistemas Externos</p>
              <div className="space-y-3">
                {invoice.quickbooks_invoice_id && (
                  <div className="flex items-start gap-2">
                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">QB</span>
                    <p className="text-sm text-gray-700 font-mono flex-1">
                      {invoice.quickbooks_invoice_id}
                    </p>
                  </div>
                )}
                {invoice.stripe_invoice_id && (
                  <div className="flex items-start gap-2">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">Stripe</span>
                    <p className="text-sm text-gray-700 font-mono flex-1">
                      {invoice.stripe_invoice_id}
                    </p>
                  </div>
                )}
                {invoice.stripePaymentIntentId && (
                  <div className="flex items-start gap-2">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded">Payment</span>
                    <p className="text-sm text-gray-700 font-mono flex-1">
                      {invoice.stripePaymentIntentId}
                    </p>
                  </div>
                )}
                {!invoice.quickbooks_invoice_id &&
                  !invoice.stripe_invoice_id &&
                  !invoice.stripePaymentIntentId && (
                    <p className="text-gray-400 text-sm">Nenhum ID externo sincronizado ainda</p>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Information */}
        {invoice.customer && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Informações do Cliente</h2>
            <div className="space-y-6">
              {/* Customer Name with Link */}
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Cliente</p>
                <Link
                  href={`/dashboard/customers/${invoice.customer.id}`}
                  className="text-2xl font-bold text-blue-600 hover:text-blue-700 hover:underline"
                >
                  {invoice.customer.name}
                </Link>
              </div>

              {/* Contact Info */}
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Email</p>
                  <a 
                    href={`mailto:${invoice.customer.email}`}
                    className="text-gray-900 hover:text-blue-600 transition-colors"
                  >
                    {invoice.customer.email}
                  </a>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Telefone</p>
                  {invoice.customer.phone ? (
                    <a 
                      href={`tel:${invoice.customer.phone}`}
                      className="text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {invoice.customer.phone}
                    </a>
                  ) : (
                    <p className="text-gray-400 text-sm">Não informado</p>
                  )}
                </div>
              </div>

              {/* Source Badges */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-3">Fontes de Dados</p>
                <div className="flex flex-wrap gap-2">
                  {invoice.customer.quickbooks_id && (
                    <span className="px-3 py-1.5 bg-green-100 text-green-800 rounded-lg text-sm font-medium">
                      QuickBooks
                    </span>
                  )}
                  {invoice.customer.pipedrive_id && (
                    <span className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
                      Pipedrive
                    </span>
                  )}
                  {!invoice.customer.quickbooks_id && !invoice.customer.pipedrive_id && (
                    <span className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">
                      Entrada Manual
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Financial Summary */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-4">Resumo Financeiro</p>
                <div className="space-y-3">
                  {invoice.customer.qbBalance !== null && invoice.customer.qbBalance !== undefined && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Saldo Atual</span>
                      <span className={`text-lg font-bold ${Number(invoice.customer.qbBalance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {Number(invoice.customer.qbBalance).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    </div>
                  )}
                  {invoice.customer.qbTotalInvoiced !== null && invoice.customer.qbTotalInvoiced !== undefined && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Total Faturado</span>
                      <span className="text-lg font-semibold text-gray-900">
                        {Number(invoice.customer.qbTotalInvoiced).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    </div>
                  )}
                  {invoice.customer.qbTotalPaid !== null && invoice.customer.qbTotalPaid !== undefined && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Total Pago</span>
                      <span className="text-lg font-semibold text-green-600">
                        {Number(invoice.customer.qbTotalPaid).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    </div>
                  )}
                  {(!invoice.customer.qbBalance && !invoice.customer.qbTotalInvoiced && !invoice.customer.qbTotalPaid) && (
                    <p className="text-sm text-gray-400 p-3 bg-gray-50 rounded-lg text-center">
                      Nenhum dado financeiro sincronizado ainda
                    </p>
                  )}
                </div>
                {invoice.customer.lastQbBalanceSync && (
                  <p className="text-xs text-gray-500 mt-3">
                    Última sincronização: {new Date(invoice.customer.lastQbBalanceSync).toLocaleDateString("pt-BR", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: businessTimeZone,
                    })}
                  </p>
                )}
              </div>

              {/* Link to View All Customer Invoices */}
              <div className="pt-4">
                <Link
                  href={`/dashboard/customers/${invoice.customer.id}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Ver Todas as Faturas do Cliente →
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Sections in Full Width */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">

          {/* Deal */}
          {invoice.deal && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Negócio Relacionado</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Título</p>
                  <Link
                    href={`/dashboard/deals/${invoice.deal.id}`}
                    className="text-lg font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {invoice.deal.title}
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Valor do Negócio</p>
                    <p className="text-lg font-bold text-gray-900">
                      {invoice.deal.currency} {Number(invoice.deal.value).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Status</p>
                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-sm font-medium">
                      {invoice.deal.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Contract Status Card */}
          <ContractStatusCard
            contract={invoice.contract}
            invoiceId={invoice.id}
            customerEmail={invoice.customer?.email || ""}
            customerName={invoice.customer?.name || ""}
          />

          {/* Payment Status Card */}
          <PaymentStatusCard
            invoice={{
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              status: invoice.status,
              amount: invoice.amount,
              dueDate: invoice.dueDate,
              paidAt: invoice.paidAt,
              amountPaid: invoice.amountPaid,
              paymentMethod: invoice.paymentMethod,
              stripePaymentLinkId: invoice.stripePaymentLinkId,
              stripePaymentIntentId: invoice.stripePaymentIntentId,
              lastPaymentReminderAt: invoice.lastPaymentReminderAt,
              paymentReminderCount: invoice.paymentReminderCount,
            }}
            contractStatus={invoice.contract?.status || null}
          />

          {/* Collection Calls Section - Only show for OVERDUE invoices */}
          {(invoice.status === InvoiceStatus.OVERDUE || isOverdue) &&
            invoice.status !== InvoiceStatus.PAID &&
            canApprove && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Chamadas de Cobrança</h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-lg text-xs font-medium bg-orange-100 text-orange-800">
                    AI Voice
                  </span>
                </div>

                <CollectionCallButton
                  invoiceId={invoice.id}
                  customerPhone={invoice.customer?.phone || null}
                  isOverdue={isOverdue || invoice.status === InvoiceStatus.OVERDUE}
                  lastCallAt={invoice.lastCollectionCallAt}
                  callCount={invoice.collectionCallCount}
                />

                <CollectionCallHistory invoiceId={invoice.id} />
              </div>
            )}

          {/* Additional Information */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informações Adicionais</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Criada em</p>
                  <p className="text-sm text-gray-900">
                    {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: businessTimeZone,
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Última Atualização</p>
                  <p className="text-sm text-gray-900">
                    {new Date(invoice.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                      timeZone: businessTimeZone,
                    })}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">ID Interno</p>
                <p className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                  {invoice.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
