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
import { DeleteInvoiceButton } from "@/components/invoices/delete-invoice-button";
import { Edit, Download, ArrowLeft } from "lucide-react";

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
    <div className="container mx-auto p-6 space-y-6">
      {/* Back Link */}
      <Link
        href="/dashboard/invoices"
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Invoices
      </Link>

      {/* Header Section with Actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Title and Badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold text-gray-900">
              Invoice {invoice.invoiceNumber || invoice.id.slice(0, 8)}
            </h1>
            <ApprovalStatusBadge status={invoice.approvalStatus as any} />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/dashboard/invoices/${invoice.id}/edit`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </Link>
            
            <DeleteInvoiceButton
              invoiceId={invoice.id}
              invoiceNumber={invoice.invoiceNumber || invoice.id.slice(0, 8)}
              hasQuickbooksId={!!invoice.quickbooks_invoice_id}
              userRole={userRole}
            />

            {invoice.pdfUrl && (
              <a
                href={invoice.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Download PDF
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Key Financial Information - Prominent Display */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Amount Card */}
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-sm font-medium text-gray-600 mb-2">Total Amount</p>
          <p className="text-4xl font-bold text-gray-900">
            {Number(invoice.amount).toLocaleString("en-US", {
              style: "currency",
              currency: "USD",
            })}
          </p>
        </div>

        {/* Status Card */}
        <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
          invoice.status === InvoiceStatus.PAID
            ? "border-green-500"
            : isOverdue
            ? "border-red-500"
            : invoice.status === InvoiceStatus.SENT
            ? "border-blue-500"
            : "border-gray-300"
        }`}>
          <p className="text-sm font-medium text-gray-600 mb-2">Status</p>
          <span
            className={`inline-block px-4 py-2 text-lg font-bold rounded-lg ${
              invoice.status === InvoiceStatus.PAID
                ? "bg-green-100 text-green-800"
                : isOverdue
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

        {/* Due Date Card */}
        <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${
          isOverdue && invoice.status !== InvoiceStatus.PAID ? "border-orange-500" : "border-gray-300"
        }`}>
          <p className="text-sm font-medium text-gray-600 mb-2">Due Date</p>
          <p className={`text-3xl font-bold ${
            isOverdue && invoice.status !== InvoiceStatus.PAID ? "text-red-600" : "text-gray-900"
          }`}>
            {new Date(invoice.dueDate).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric"
            })}
          </p>
          {isOverdue && invoice.status !== InvoiceStatus.PAID && (
            <p className="text-sm font-semibold text-red-600 mt-1">
              Overdue by {Math.floor((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24))} days
            </p>
          )}
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
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Workflow Progress</h2>
        <WorkflowTimeline steps={workflowSteps} />
      </div>

      {/* Main Content: Two-Column Layout (Invoice Details + Customer Info) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Invoice Details */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Invoice Details</h2>
          <div className="space-y-6">
            {/* Basic Info Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Invoice Number</p>
                <p className="text-base font-semibold text-gray-900">
                  {invoice.invoiceNumber || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Created Date</p>
                <p className="text-base text-gray-900">
                  {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                </p>
              </div>
            </div>

            {/* Payment Info */}
            {invoice.paidAt && (
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-2">Payment Information</p>
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    <p className="text-sm font-semibold text-green-800">Payment Received</p>
                  </div>
                  <p className="text-sm text-green-700">
                    <span className="font-medium">Date:</span>{" "}
                    {new Date(invoice.paidAt).toLocaleDateString("en-US", {
                      month: "long",
                      day: "numeric",
                      year: "numeric"
                    })}
                  </p>
                  {invoice.paymentMethod && (
                    <p className="text-sm text-green-700">
                      <span className="font-medium">Method:</span> {invoice.paymentMethod}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* External IDs */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-600 mb-3">External System IDs</p>
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
                    <p className="text-gray-400 text-sm">No external IDs synced yet</p>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Customer Information */}
        {invoice.customer && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">Customer Information</h2>
            <div className="space-y-6">
              {/* Customer Name with Link */}
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">Customer</p>
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
                  <p className="text-sm font-medium text-gray-600 mb-1">Phone</p>
                  {invoice.customer.phone ? (
                    <a 
                      href={`tel:${invoice.customer.phone}`}
                      className="text-gray-900 hover:text-blue-600 transition-colors"
                    >
                      {invoice.customer.phone}
                    </a>
                  ) : (
                    <p className="text-gray-400 text-sm">Not provided</p>
                  )}
                </div>
              </div>

              {/* Source Badges */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-3">Data Sources</p>
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
                      Manual Entry
                    </span>
                  )}
                </div>
              </div>

              {/* Customer Financial Summary */}
              <div className="pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-600 mb-4">Financial Summary</p>
                <div className="space-y-3">
                  {invoice.customer.qbBalance !== null && invoice.customer.qbBalance !== undefined && (
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm font-medium text-gray-700">Current Balance</span>
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
                      <span className="text-sm font-medium text-gray-700">Total Invoiced</span>
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
                      <span className="text-sm font-medium text-gray-700">Total Paid</span>
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
                      No financial data synced yet
                    </p>
                  )}
                </div>
                {invoice.customer.lastQbBalanceSync && (
                  <p className="text-xs text-gray-500 mt-3">
                    Last synced: {new Date(invoice.customer.lastQbBalanceSync).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric"
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
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Related Deal</h2>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Title</p>
                  <Link
                    href={`/dashboard/deals/${invoice.deal.id}`}
                    className="text-lg font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    {invoice.deal.title}
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">Deal Value</p>
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
                  <h3 className="text-lg font-semibold text-gray-900">Collection Calls</h3>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Created</p>
                  <p className="text-sm text-gray-900">
                    {new Date(invoice.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Last Updated</p>
                  <p className="text-sm text-gray-900">
                    {new Date(invoice.updatedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Internal ID</p>
                <p className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                  {invoice.id}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
