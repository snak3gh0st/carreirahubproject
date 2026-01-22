import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus, ContractStatus } from "@prisma/client";
import Link from "next/link";
import { ApprovalStatusBadge } from "@/components/invoices/approval-status-badge";
import { ApproveRejectActions } from "@/components/invoices/approve-reject-actions";
import { WorkflowTimeline } from "@/components/invoices/workflow-timeline";
import { ContractStatusCard } from "@/components/invoices/contract-status-card";
import { PaymentStatusCard } from "@/components/invoices/payment-status-card";
import { CollectionCallButton } from "@/components/invoices/collection-call-button";
import { CollectionCallHistory } from "@/components/invoices/collection-call-history";

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
      approver: {
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

  const isOverdue =
    invoice.status === InvoiceStatus.OVERDUE ||
    (invoice.status === InvoiceStatus.SENT &&
      new Date(invoice.dueDate) < new Date());

  // Check if user can approve
  const canApprove = userRole === "FINANCE" || userRole === "ADMIN";

  // Build workflow steps
  const workflowSteps = [
    {
      title: "Invoice Created",
      status: "completed" as const,
      date: invoice.createdAt,
      description: `Created by ${invoice.deal?.owner?.name || "System"}`,
    },
    {
      title: "Awaiting Approval",
      status:
        invoice.approvalStatus === "PENDING"
          ? ("current" as const)
          : invoice.approvalStatus === "REJECTED"
          ? ("failed" as const)
          : ("completed" as const),
      date: invoice.approvalStatus !== "PENDING" ? invoice.approvedAt : null,
      description:
        invoice.approvalStatus === "APPROVED"
          ? `Approved by ${invoice.approver?.name || "Finance"}`
          : invoice.approvalStatus === "REJECTED"
          ? `Rejected: ${invoice.rejectedReason || "No reason provided"}`
          : "Waiting for FINANCE approval",
    },
    {
      title: "Contract Sent",
      status: invoice.contract
        ? invoice.contract.status === ContractStatus.DECLINED ||
          invoice.contract.status === ContractStatus.EXPIRED
          ? ("failed" as const)
          : ("completed" as const)
        : invoice.approvalStatus === "APPROVED"
        ? ("current" as const)
        : ("pending" as const),
      date: invoice.contract?.sentAt,
      description: invoice.contract
        ? `Sent to ${invoice.contract.signerEmail}`
        : invoice.approvalStatus === "APPROVED"
        ? "Generating contract..."
        : "Contract will be sent after approval",
    },
    {
      title: "Contract Signed",
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
          ? "Client signed the contract"
          : invoice.contract?.status === ContractStatus.DECLINED
          ? "Client declined to sign"
          : invoice.contract?.status === ContractStatus.EXPIRED
          ? "Contract expired"
          : invoice.contract?.status === ContractStatus.SENT_FOR_SIGNATURE
          ? `Awaiting signature (${invoice.contract?.reminderCount || 0} reminders sent)`
          : "Waiting for contract to be signed",
    },
    {
      title: "Payment Link Sent",
      status:
        invoice.stripePaymentLinkId
          ? ("completed" as const)
          : invoice.contract?.status === ContractStatus.SIGNED
          ? ("current" as const)
          : ("pending" as const),
      date: invoice.stripePaymentLinkId ? invoice.updatedAt : null,
      description: invoice.stripePaymentLinkId
        ? "Payment link sent to customer"
        : invoice.contract?.status === ContractStatus.SIGNED
        ? "Generating payment link..."
        : "Payment link will be sent after contract is signed",
    },
    {
      title: "Payment Received",
      status:
        invoice.status === InvoiceStatus.PAID
          ? ("completed" as const)
          : invoice.stripePaymentLinkId
          ? ("current" as const)
          : ("pending" as const),
      date: invoice.paidAt,
      description:
        invoice.status === InvoiceStatus.PAID
          ? `Paid via ${invoice.paymentMethod || "Stripe"}`
          : invoice.stripePaymentLinkId
          ? `Awaiting payment (${invoice.paymentReminderCount || 0} reminders sent)`
          : "Waiting for payment",
    },
  ];

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <Link
          href="/dashboard/invoices"
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Voltar para Invoices
        </Link>
        <div className="flex items-center justify-between mt-4">
          <h1 className="text-3xl font-bold">
            Invoice {invoice.invoiceNumber || invoice.id.slice(0, 8)}
          </h1>
          <ApprovalStatusBadge status={invoice.approvalStatus as any} />
        </div>
      </div>

      {/* Approval Section */}
      {invoice.approvalStatus === "PENDING" && canApprove && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-orange-900 mb-2">
                This invoice requires your approval
              </h2>
              <p className="text-sm text-orange-700 mb-4">
                Please review the invoice details below and approve or reject it. Once approved,
                the contract will be automatically sent to the client via DocuSign.
              </p>
            </div>
          </div>
          <ApproveRejectActions
            invoiceId={invoice.id}
            invoiceNumber={invoice.invoiceNumber || invoice.id.slice(0, 8)}
          />
        </div>
      )}

      {invoice.approvalStatus === "APPROVED" && invoice.approver && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-green-900 mb-2">
            Invoice Approved
          </h2>
          <p className="text-sm text-green-700">
            Approved by <strong>{invoice.approver.name}</strong> on{" "}
            {invoice.approvedAt ? new Date(invoice.approvedAt).toLocaleString() : "N/A"}
          </p>
          {invoice.quickbooks_invoice_id && (
            <p className="text-sm text-green-700 mt-1">
              Synced to QuickBooks (ID: {invoice.quickbooks_invoice_id})
            </p>
          )}
        </div>
      )}

      {invoice.approvalStatus === "REJECTED" && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-red-900 mb-2">
            Invoice Rejected
          </h2>
          {invoice.approver && (
            <p className="text-sm text-red-700">
              Rejected by <strong>{invoice.approver.name}</strong> on{" "}
              {invoice.approvedAt ? new Date(invoice.approvedAt).toLocaleString() : "N/A"}
            </p>
          )}
          {invoice.rejectedReason && (
            <div className="mt-3 p-3 bg-white border border-red-200 rounded">
              <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
              <p className="text-sm text-gray-900">{invoice.rejectedReason}</p>
            </div>
          )}
        </div>
      )}

      {/* Workflow Timeline */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-6">Workflow Progress</h2>
        <WorkflowTimeline steps={workflowSteps} />
      </div>

      {/* Main Content: Two-Column Layout (Invoice Details + Customer Info) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Column: Invoice Details */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Invoice Information</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Status</p>
                <span
                  className={`inline-block mt-1 px-3 py-1 text-sm rounded-full ${
                    invoice.status === InvoiceStatus.PAID
                      ? "bg-green-100 text-green-800"
                      : invoice.status === InvoiceStatus.OVERDUE || isOverdue
                      ? "bg-red-100 text-red-800"
                      : invoice.status === InvoiceStatus.SENT
                      ? "bg-blue-100 text-blue-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {invoice.status}
                  {isOverdue && invoice.status !== InvoiceStatus.PAID && " (Overdue)"}
                </span>
              </div>
              <div>
                <p className="text-sm text-gray-600">Amount</p>
                <p className="text-2xl font-bold mt-1">
                  {Number(invoice.amount).toLocaleString("en-US", {
                    style: "currency",
                    currency: "USD",
                  })}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Due Date</p>
                <p className={`mt-1 ${isOverdue && invoice.status !== InvoiceStatus.PAID ? "text-red-600 font-semibold" : ""}`}>
                  {new Date(invoice.dueDate).toLocaleDateString("pt-BR")}
                  {isOverdue && invoice.status !== InvoiceStatus.PAID && (
                    <span className="block text-xs text-red-600 font-semibold mt-1">
                      Overdue
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Created</p>
                <p className="mt-1">
                  {new Date(invoice.createdAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
            </div>

            {/* Payment Info */}
            {invoice.paidAt && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600">Payment Date</p>
                <p className="mt-1 text-green-600 font-medium">
                  {new Date(invoice.paidAt).toLocaleDateString("pt-BR")}
                </p>
                {invoice.paymentMethod && (
                  <p className="text-sm text-gray-500 mt-1">
                    Via {invoice.paymentMethod}
                  </p>
                )}
              </div>
            )}

            {/* External IDs */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600 mb-2">External IDs</p>
              <div className="space-y-1 text-sm">
                {invoice.quickbooks_invoice_id && (
                  <p className="text-gray-700">
                    <span className="font-medium">QuickBooks:</span> {invoice.quickbooks_invoice_id}
                  </p>
                )}
                {invoice.stripe_invoice_id && (
                  <p className="text-gray-700">
                    <span className="font-medium">Stripe Invoice:</span> {invoice.stripe_invoice_id}
                  </p>
                )}
                {invoice.stripePaymentIntentId && (
                  <p className="text-gray-700">
                    <span className="font-medium">Stripe Payment:</span> {invoice.stripePaymentIntentId}
                  </p>
                )}
                {!invoice.quickbooks_invoice_id &&
                  !invoice.stripe_invoice_id &&
                  !invoice.stripePaymentIntentId && (
                    <p className="text-gray-400 text-sm">No external IDs yet</p>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Information */}
        {invoice.customer && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Customer Information</h2>
            <div className="space-y-4">
              {/* Customer Name with Link */}
              <div>
                <p className="text-sm text-gray-600 mb-1">Name</p>
                <Link
                  href={`/dashboard/customers/${invoice.customer.id}`}
                  className="text-lg font-semibold text-blue-600 hover:underline"
                >
                  {invoice.customer.name}
                </Link>
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="text-gray-900">{invoice.customer.email}</p>
                </div>
                {invoice.customer.phone && (
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="text-gray-900">{invoice.customer.phone}</p>
                  </div>
                )}
                {!invoice.customer.phone && (
                  <div>
                    <p className="text-sm text-gray-600">Phone</p>
                    <p className="text-gray-400 text-sm">Not provided</p>
                  </div>
                )}
              </div>

              {/* Source Badges */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-2">Data Sources</p>
                <div className="flex flex-wrap gap-2">
                  {invoice.customer.quickbooks_id && (
                    <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                      QuickBooks
                    </span>
                  )}
                  {invoice.customer.pipedrive_id && (
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                      Pipedrive
                    </span>
                  )}
                  {!invoice.customer.quickbooks_id && !invoice.customer.pipedrive_id && (
                    <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded text-sm font-medium">
                      Manual Entry
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Financial Summary */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-600 mb-3">Financial Summary</p>
                <div className="space-y-2">
                  {invoice.customer.qbBalance !== null && invoice.customer.qbBalance !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Current Balance:</span>
                      <span className={`font-semibold ${Number(invoice.customer.qbBalance) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {Number(invoice.customer.qbBalance).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    </div>
                  )}
                  {invoice.customer.qbTotalInvoiced !== null && invoice.customer.qbTotalInvoiced !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Total Invoiced:</span>
                      <span className="font-medium text-gray-900">
                        {Number(invoice.customer.qbTotalInvoiced).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    </div>
                  )}
                  {invoice.customer.qbTotalPaid !== null && invoice.customer.qbTotalPaid !== undefined && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-700">Total Paid:</span>
                      <span className="font-medium text-green-600">
                        {Number(invoice.customer.qbTotalPaid).toLocaleString("en-US", {
                          style: "currency",
                          currency: "USD",
                        })}
                      </span>
                    </div>
                  )}
                  {(!invoice.customer.qbBalance && !invoice.customer.qbTotalInvoiced && !invoice.customer.qbTotalPaid) && (
                    <p className="text-sm text-gray-400">
                      No financial data synced yet
                    </p>
                  )}
                </div>
                {invoice.customer.lastQbBalanceSync && (
                  <p className="text-xs text-gray-400 mt-2">
                    Last synced: {new Date(invoice.customer.lastQbBalanceSync).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>

              {/* Link to View All Customer Invoices */}
              <div className="pt-4">
                <Link
                  href={`/dashboard/customers/${invoice.customer.id}`}
                  className="inline-flex items-center text-sm text-blue-600 hover:underline"
                >
                  View All Customer Invoices →
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
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Related Deal</h2>
              <div className="space-y-2">
                <p>
                  <span className="font-medium">Title:</span>{" "}
                  <Link
                    href={`/dashboard/deals/${invoice.deal.id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {invoice.deal.title}
                  </Link>
                </p>
                <p>
                  <span className="font-medium">Value:</span>{" "}
                  {invoice.deal.currency} {Number(invoice.deal.value).toLocaleString()}
                </p>
                <p>
                  <span className="font-medium">Status:</span> {invoice.deal.status}
                </p>
              </div>
            </div>
          )}

          {/* PDF */}
          {invoice.pdfUrl && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Document</h2>
              <a
                href={invoice.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View PDF →
              </a>
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
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Collection Calls</h3>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
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

          {/* Informações Adicionais */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="font-semibold mb-4">Information</h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-600">Invoice Number:</span>
                <br />
                <span className="font-medium">
                  {invoice.invoiceNumber || "N/A"}
                </span>
              </p>
              <p>
                <span className="text-gray-600">Created:</span>
                <br />
                {new Date(invoice.createdAt).toLocaleString("pt-BR")}
              </p>
              <p>
                <span className="text-gray-600">Updated:</span>
                <br />
                {new Date(invoice.updatedAt).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
