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
import { CopyQbInvoiceLinkButton } from "@/components/invoices/copy-qb-invoice-link-button";
import { normalizeDateOnly, differenceInCalendarDaysUTC } from "@/lib/utils/date";
import {
  Edit, Download, ArrowLeft, FileText, DollarSign, Calendar,
  User, Mail, Phone, ExternalLink, CheckCircle2, Clock, AlertTriangle,
  CreditCard, Hash, Building2, Send, XCircle, Shield,
} from "lucide-react";

function statusDisplay(status: InvoiceStatus, isOverdue: boolean) {
  if (status === "PAID") return { label: "Pago", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200" };
  if (status === "OVERDUE" || isOverdue) return { label: "Vencida", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" };
  if (status === "SENT") return { label: "Enviada", icon: Send, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" };
  if (status === "PARTIALLY_PAID") return { label: "Parcialmente Pago", icon: CreditCard, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200" };
  if (status === "VOID") return { label: "Anulada", icon: XCircle, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" };
  return { label: "Rascunho", icon: FileText, color: "text-gray-500", bg: "bg-gray-50", border: "border-gray-200" };
}

function formatQuickbooksDeliveryError(error: string | null) {
  if (!error) {
    return {
      description: "Envio automatico ainda nao confirmado no QuickBooks.",
      note: null as string | null,
    };
  }

  if (error.includes("Object Not Found") || error.includes('"code":"610"') || error.includes('"code": "610"')) {
    return {
      description: "O QuickBooks nao encontrou esta invoice para enviar.",
      note: "O identificador salvo no hub nao existe mais na conta atual do QuickBooks.",
    };
  }

  if (error.includes("Invalid ID") || error.includes('"code":"2030"') || error.includes('"code": "2030"')) {
    return {
      description: "O identificador da invoice no QuickBooks esta invalido.",
      note: "Essa invoice precisa ser resincronizada com um ID valido antes de um novo envio.",
    };
  }

  if (error.includes("AuthenticationFailed") || error.includes("invalid_grant")) {
    return {
      description: "A autenticacao do QuickBooks expirou durante o envio.",
      note: "O OAuth do QuickBooks precisa ser reconectado para liberar novos envios.",
    };
  }

  return {
    description: "Falha no envio automatico pelo QuickBooks.",
    note: error.length > 180 ? `${error.slice(0, 177)}...` : error,
  };
}

export default async function InvoiceDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const userRole = (session.user as any).role;
  if (!["ADMIN", "FINANCE", "COMMERCIAL"].includes(userRole)) redirect("/dashboard");

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      deal: { include: { customer: { select: { id: true, name: true, email: true } }, owner: { select: { id: true, name: true } } } },
      contract: true,
      owner: { select: { id: true, name: true, email: true } },
    },
  });

  if (!invoice) notFound();

  const userId = (session.user as any).id;
  if (userRole === "COMMERCIAL" && invoice.ownerId !== userId) redirect("/dashboard");

  const dueDateOnly = normalizeDateOnly(invoice.dueDate);
  const overdueDays = differenceInCalendarDaysUTC(new Date(), dueDateOnly);
  const isOverdue = invoice.status === InvoiceStatus.OVERDUE || (invoice.status === InvoiceStatus.SENT && overdueDays > 0);
  const canApprove = userRole === "FINANCE" || userRole === "ADMIN";
  const canEdit = (userRole === "ADMIN" || userRole === "FINANCE" || (userRole === "COMMERCIAL" && invoice.ownerId === userId))
    && invoice.status !== InvoiceStatus.PAID && invoice.status !== InvoiceStatus.VOID;

  const tz = "America/Sao_Paulo";
  const sd = statusDisplay(invoice.status, isOverdue);
  const StatusIcon = sd.icon;
  const amount = Number(invoice.amount);
  const paidAmount = Number(invoice.amountPaid || 0);
  const remaining = amount - paidAmount;
  const daysUntilDue = differenceInCalendarDaysUTC(dueDateOnly, new Date());
  const deliveryFailure = formatQuickbooksDeliveryError(invoice.lastEmailSendError);

  const contractStep =
    !invoice.contract
      ? {
          title: "Contrato do pacote",
          status: "pending" as const,
          date: null,
          description: "Nenhum contrato gerado para o pacote deste servico.",
          note: "O contrato pode cobrir toda a serie de invoices vinculadas ao servico.",
        }
      : invoice.contract.status === ContractStatus.SIGNED
      ? {
          title: "Contrato do pacote",
          status: "completed" as const,
          date: invoice.contract.signedAt ?? invoice.contract.sentAt,
          description: "Contrato do pacote concluido pelo cliente.",
          note: invoice.contract.signerEmail,
        }
      : invoice.contract.status === ContractStatus.SENT_FOR_SIGNATURE || invoice.contract.status === ContractStatus.VIEWED
      ? {
          title: "Contrato do pacote",
          status: "current" as const,
          date: invoice.contract.sentAt,
          description: "Contrato do pacote enviado e aguardando resposta do cliente.",
          note: `${invoice.contract.reminderCount || 0} lembrete(s) enviados.`,
        }
      : invoice.contract.status === ContractStatus.DECLINED || invoice.contract.status === ContractStatus.EXPIRED
      ? {
          title: "Contrato do pacote",
          status: "failed" as const,
          date: invoice.contract.sentAt,
          description: invoice.contract.status === ContractStatus.DECLINED ? "Cliente recusou o contrato do pacote." : "Contrato do pacote expirou sem assinatura.",
          note: invoice.contract.signerEmail,
        }
      : {
          title: "Contrato do pacote",
          status: "pending" as const,
          date: null,
          description: "Contrato do pacote em preparacao.",
          note: invoice.contract.signerEmail,
        };

  const deliveryStep =
    invoice.status === InvoiceStatus.VOID
      ? {
          title: "Entrega ao cliente",
          status: "pending" as const,
          date: null,
          description: "Fatura anulada. O envio ao cliente nao se aplica.",
          note: null,
        }
      : invoice.emailSentAt
      ? {
          title: "Entrega ao cliente",
          status: "completed" as const,
          date: invoice.emailSentAt,
          description: `Invoice enviada para ${invoice.customer.email}.`,
          note: invoice.quickbooks_invoice_link ? "Link publico do QuickBooks armazenado no hub." : null,
        }
      : invoice.lastEmailSendError
      ? {
          title: "Entrega ao cliente",
          status: "failed" as const,
          date: null,
          description: deliveryFailure.description,
          note: deliveryFailure.note,
        }
      : invoice.quickbooks_invoice_id
      ? {
          title: "Entrega ao cliente",
          status: daysUntilDue > 7 ? ("pending" as const) : ("current" as const),
          date: null,
          description:
            daysUntilDue > 7
              ? "Envio automatico programado para a janela de 7 dias antes do vencimento."
              : "Invoice pronta no QuickBooks para envio ao cliente.",
          note:
            invoice.quickbooks_invoice_link
              ? "O time comercial ja pode copiar o link do QuickBooks pelo hub."
              : "O hub ainda nao recebeu o link publico desta invoice.",
        }
      : {
          title: "Entrega ao cliente",
          status: "pending" as const,
          date: null,
          description: "Aguardando sincronizacao com o QuickBooks.",
          note: null,
        };

  const paymentStep =
    invoice.status === InvoiceStatus.PAID
      ? {
          title: "Pagamento",
          status: "completed" as const,
          date: invoice.paidAt,
          description: `Pagamento confirmado via ${invoice.paymentMethod || "QuickBooks"}.`,
          note: null,
        }
      : invoice.status === InvoiceStatus.PARTIALLY_PAID
      ? {
          title: "Pagamento",
          status: "current" as const,
          date: invoice.paidAt,
          description: "Pagamento parcial registrado.",
          note: `Saldo atual de $${remaining.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`,
        }
      : isOverdue
      ? {
          title: "Pagamento",
          status: "failed" as const,
          date: null,
          description: `Pagamento em atraso ha ${overdueDays} dia(s).`,
          note: invoice.paymentReminderCount > 0 ? `${invoice.paymentReminderCount} lembrete(s) de pagamento enviados.` : null,
        }
      : {
          title: "Pagamento",
          status: "current" as const,
          date: null,
          description: "Aguardando pagamento do cliente.",
          note: `Vencimento em ${Math.max(daysUntilDue, 0)} dia(s).`,
        };

  const workflowSteps = [
    {
      title: "Fatura criada",
      status: "completed" as const,
      date: invoice.createdAt,
      description: `Criada por ${invoice.deal?.owner?.name || invoice.owner?.name || "Sistema"}.`,
      note: invoice.invoiceNumber || null,
    },
    {
      title: "QuickBooks",
      status: invoice.quickbooks_invoice_id ? ("completed" as const) : ("current" as const),
      date: invoice.quickbooks_invoice_id ? invoice.updatedAt : null,
      description: invoice.quickbooks_invoice_id ? `Sincronizada com QuickBooks (ID ${invoice.quickbooks_invoice_id}).` : "Sincronizacao com QuickBooks em andamento.",
      note: invoice.quickbooks_invoice_link ? "Link publico do cliente ja salvo no hub." : "O link publico ainda sera carregado do QuickBooks.",
    },
    contractStep,
    deliveryStep,
    paymentStep,
  ];

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto p-6 md:p-8 max-w-6xl">
        {/* Breadcrumb */}
        <Link href="/dashboard/invoices" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para Faturas
        </Link>

        {/* Hero Header */}
        <div className={`rounded-2xl border ${sd.border} ${sd.bg} p-6 mb-6`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-white/80 shadow-sm">
                <StatusIcon className={`h-7 w-7 ${sd.color}`} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-xl font-display font-bold text-gray-900">
                    #{invoice.invoiceNumber || invoice.id.slice(0, 8)}
                  </h1>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${sd.bg} ${sd.color} border ${sd.border}`}>
                    {sd.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600">
                  {invoice.customer.name} &mdash; {invoice.customer.email}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isOverdue && invoice.status !== InvoiceStatus.PAID && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-red-100 text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Vencida há {overdueDays} dias
                </div>
              )}
              {canEdit && (
                <Link
                  href={`/dashboard/invoices/${invoice.id}/edit`}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors"
                >
                  <Edit className="w-4 h-4" />
                  Editar
                </Link>
              )}
              {invoice.pdfUrl && (
                <a href={invoice.pdfUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-xl border border-gray-200 hover:bg-gray-50 shadow-sm transition-colors">
                  <Download className="w-4 h-4" />
                  PDF
                </a>
              )}
              {invoice.quickbooks_invoice_id && invoice.status !== InvoiceStatus.VOID && (
                <CopyQbInvoiceLinkButton
                  invoiceId={invoice.id}
                  cachedLink={invoice.quickbooks_invoice_link}
                />
              )}
              <DeleteInvoiceButton invoiceId={invoice.id} invoiceNumber={invoice.invoiceNumber || invoice.id.slice(0, 8)} hasQuickbooksId={!!invoice.quickbooks_invoice_id} userRole={userRole} />
            </div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Valor Total</span>
            </div>
            <p className="text-2xl font-display font-bold text-gray-900 tabular-nums">
              ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div className={`bg-white rounded-2xl border p-5 shadow-sm ${isOverdue && invoice.status !== InvoiceStatus.PAID ? "border-red-200" : "border-gray-100"}`}>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vencimento</span>
            </div>
            <p className={`text-2xl font-display font-bold tabular-nums ${isOverdue && invoice.status !== InvoiceStatus.PAID ? "text-red-600" : "text-gray-900"}`}>
              {dueDateOnly.toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}
            </p>
          </div>

          {invoice.status === InvoiceStatus.PAID ? (
            <div className="bg-white rounded-2xl border border-emerald-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Pago em</span>
              </div>
              <p className="text-2xl font-display font-bold text-emerald-700 tabular-nums">
                {invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("pt-BR", { month: "short", day: "numeric", timeZone: tz }) : "-"}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-gray-400" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Saldo</span>
              </div>
              <p className="text-2xl font-display font-bold text-gray-900 tabular-nums">
                ${remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">QuickBooks</span>
            </div>
            <p className="text-lg font-display font-bold text-gray-900">
              {invoice.quickbooks_invoice_id ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="font-mono text-sm">#{invoice.quickbooks_invoice_id}</span>
                </span>
              ) : (
                <span className="text-gray-400 text-sm">Pendente</span>
              )}
            </p>
          </div>
        </div>

        {/* Payment Progress (for partially paid) */}
        {invoice.status === InvoiceStatus.PARTIALLY_PAID && (
          <div className="bg-white rounded-2xl border border-amber-100 p-5 mb-6 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Progresso do pagamento</span>
              <span className="text-sm font-bold text-amber-700">{Math.round((paidAmount / amount) * 100)}%</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${(paidAmount / amount) * 100}%` }} />
            </div>
            <div className="flex justify-between mt-2 text-xs text-gray-500">
              <span>Pago: ${paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              <span>Restante: ${remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        )}

        {/* Workflow Timeline */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 shadow-sm">
          <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide mb-5">Status Operacional</h2>
          <WorkflowTimeline steps={workflowSteps} />
        </div>

        {/* Two-Column Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left: Customer + Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Card */}
            {invoice.customer && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Cliente</h2>
                </div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                      <span className="text-base font-bold text-primary-600">
                        {invoice.customer.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <Link href={`/dashboard/customers/${invoice.customer.id}`} className="font-display font-semibold text-gray-900 hover:text-primary-600 transition-colors">
                        {invoice.customer.name}
                      </Link>
                      <div className="flex items-center gap-4 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Mail className="h-3 w-3" /> {invoice.customer.email}
                        </span>
                        {invoice.customer.phone && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone className="h-3 w-3" /> {invoice.customer.phone}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {invoice.customer.quickbooks_id && (
                      <span className="px-2 py-1 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md uppercase">QB</span>
                    )}
                    <Link href={`/dashboard/customers/${invoice.customer.id}`} className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1">
                      Perfil <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>

                {/* Financial summary */}
                {(invoice.customer.qbBalance != null || invoice.customer.qbTotalPaid != null) && (
                  <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-gray-100">
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-500 mb-1">Saldo</p>
                      <p className={`text-sm font-bold ${Number(invoice.customer.qbBalance || 0) > 0 ? "text-red-600" : "text-emerald-600"}`}>
                        ${Number(invoice.customer.qbBalance || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-500 mb-1">Faturado</p>
                      <p className="text-sm font-bold text-gray-900">
                        ${Number(invoice.customer.qbTotalInvoiced || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-gray-50 rounded-xl">
                      <p className="text-xs text-gray-500 mb-1">Pago</p>
                      <p className="text-sm font-bold text-emerald-600">
                        ${Number(invoice.customer.qbTotalPaid || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Deal */}
            {invoice.deal && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Negócio</h2>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Link href={`/dashboard/deals/${invoice.deal.id}`} className="font-display font-semibold text-gray-900 hover:text-primary-600 transition-colors">
                      {invoice.deal.title}
                    </Link>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-sm text-gray-600">
                        {invoice.deal.currency} {Number(invoice.deal.value).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${invoice.deal.status === "WON" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-600"}`}>
                        {invoice.deal.status}
                      </span>
                    </div>
                  </div>
                  {invoice.deal.owner && (
                    <span className="text-xs text-gray-400">Vendedor: {invoice.deal.owner.name}</span>
                  )}
                </div>
              </div>
            )}

            {/* Payment Info */}
            {invoice.paidAt && (
              <div className="bg-white rounded-2xl border border-emerald-100 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-4 w-4 text-emerald-500" />
                  <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Pagamento Recebido</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl">
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="font-display font-semibold text-emerald-700">
                      ${paidAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-sm text-gray-500">
                      {new Date(invoice.paidAt).toLocaleDateString("pt-BR", { month: "long", day: "numeric", year: "numeric", timeZone: tz })}
                      {invoice.paymentMethod && ` via ${invoice.paymentMethod}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <ContractStatusCard
              contract={invoice.contract}
              invoiceId={invoice.id}
              customerEmail={invoice.customer?.email || ""}
              customerName={invoice.customer?.name || ""}
            />

            <PaymentStatusCard
              invoice={{ id: invoice.id, invoiceNumber: invoice.invoiceNumber, quickbooksInvoiceId: invoice.quickbooks_invoice_id, status: invoice.status, amount: Number(invoice.amount), dueDate: invoice.dueDate, paidAt: invoice.paidAt, amountPaid: Number(invoice.amountPaid || 0), paymentMethod: invoice.paymentMethod, lastPaymentReminderAt: invoice.lastPaymentReminderAt, paymentReminderCount: invoice.paymentReminderCount }}
            />

            {(invoice.status === InvoiceStatus.OVERDUE || isOverdue) && invoice.status !== InvoiceStatus.PAID && canApprove && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">Cobrança</h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 uppercase">AI Voice</span>
                </div>
                <CollectionCallButton invoiceId={invoice.id} customerPhone={invoice.customer?.phone || null} isOverdue={isOverdue || invoice.status === InvoiceStatus.OVERDUE} lastCallAt={invoice.lastCollectionCallAt} callCount={invoice.collectionCallCount} />
                <CollectionCallHistory invoiceId={invoice.id} />
              </div>
            )}

            {/* Meta */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <h3 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide mb-4">Detalhes</h3>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500 flex items-center gap-1.5"><Hash className="h-3.5 w-3.5" /> Invoice</dt>
                  <dd className="text-gray-900 font-mono text-xs">{invoice.invoiceNumber || "-"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Criada</dt>
                  <dd className="text-gray-900">{new Date(invoice.createdAt).toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric", timeZone: tz })}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500 flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Atualizada</dt>
                  <dd className="text-gray-900">{new Date(invoice.updatedAt).toLocaleDateString("pt-BR", { month: "short", day: "numeric", year: "numeric", timeZone: tz })}</dd>
                </div>
                {invoice.owner && (
                  <div className="flex justify-between">
                    <dt className="text-gray-500 flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> Responsável</dt>
                    <dd className="text-gray-900">{invoice.owner.name}</dd>
                  </div>
                )}
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
