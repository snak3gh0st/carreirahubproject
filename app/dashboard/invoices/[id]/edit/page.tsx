import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { EditInvoiceForm } from "@/components/invoices/edit-invoice-form";

/**
 * Edit Invoice Page
 * 
 * Authorization:
 * - ADMIN, FINANCE: can edit all invoices
 * - COMMERCIAL, SALES: can only edit their own invoices
 * 
 * Business Rules:
 * - Cannot edit PAID or VOIDED invoices
 * - Changes to financial fields sync with QuickBooks (if synced)
 */
export default async function EditInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Check role
  const userRole = (session.user as any).role;
  const userId = (session.user as any).id;

  // Fetch invoice with customer relation
  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
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
          email: true,
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  // Authorization check
  const canEdit =
    userRole === "ADMIN" ||
    userRole === "FINANCE" ||
    (userRole === "COMMERCIAL" && invoice.ownerId === userId);

  if (!canEdit) {
    redirect("/dashboard");
  }

  // Business rule: Cannot edit PAID or VOIDED invoices
  if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.VOID) {
    redirect(`/dashboard/invoices/${invoice.id}?error=cannot-edit-${invoice.status.toLowerCase()}`);
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Back Link */}
      <Link
        href={`/dashboard/invoices/${invoice.id}`}
        className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Voltar para Fatura
      </Link>

      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Editar Fatura {invoice.invoiceNumber || invoice.id.slice(0, 8)}
        </h1>
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <div>
            <span className="font-medium">Cliente:</span>{" "}
            <Link
              href={`/dashboard/customers/${invoice.customer.id}`}
              className="text-blue-600 hover:underline"
            >
              {invoice.customer.name}
            </Link>
          </div>
          <div>
            <span className="font-medium">Status:</span>{" "}
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                invoice.status === InvoiceStatus.SENT
                  ? "bg-blue-100 text-blue-800"
                  : invoice.status === InvoiceStatus.DRAFT
                  ? "bg-gray-100 text-gray-800"
                  : invoice.status === InvoiceStatus.OVERDUE
                  ? "bg-red-100 text-red-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {invoice.status}
            </span>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <EditInvoiceForm
          invoice={{
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            amount: Number(invoice.amount),
            dueDate: invoice.dueDate,
            description: null, // Description not stored in schema currently
            quickbooks_invoice_id: invoice.quickbooks_invoice_id,
            quickbooks_sync_token: null, // SyncToken is fetched from QB at update time
          }}
        />
      </div>

      {/* Help Text */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">Notas de Edição</h3>
        <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
          <li>Alterações no valor, data de vencimento e itens serão sincronizadas com o QuickBooks se esta fatura estiver sincronizada</li>
          <li>Os itens devem somar o valor total da fatura</li>
          <li>A data de vencimento não pode ser definida para uma data passada</li>
          <li>Faturas PAGAS ou ANULADAS não podem ser editadas</li>
        </ul>
      </div>
    </div>
  );
}
