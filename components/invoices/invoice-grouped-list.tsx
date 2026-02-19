"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { format } from "date-fns";
import { InvoiceStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { DeleteInvoiceButton } from "@/components/invoices/delete-invoice-button";
import type { Decimal } from "@prisma/client/runtime/library";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  amount: number | Decimal;
  status: InvoiceStatus;
  dueDate: Date | string;
  ownerId: string | null;
  quickbooks_invoice_id: string | null;
  customer: { id: string; name: string; email: string };
  deal: { id: string; title: string } | null;
}

interface CustomerGroup {
  customerId: string;
  customerName: string;
  customerEmail: string;
  invoices: Invoice[];
  totalAmount: number;
  invoiceCount: number;
}

interface InvoiceGroupedListProps {
  invoices: Invoice[];
  userRole: string;
  userId: string;
}

function getStatusVariant(
  status: InvoiceStatus
): "success" | "warning" | "error" | "info" | "default" {
  switch (status) {
    case "PAID":
      return "success";
    case "SENT":
      return "info";
    case "OVERDUE":
      return "error";
    case "PARTIALLY_PAID":
      return "warning";
    default:
      return "default";
  }
}

export function InvoiceGroupedList({
  invoices,
  userRole,
  userId,
}: InvoiceGroupedListProps) {
  const groups = useMemo<CustomerGroup[]>(() => {
    const map = new Map<string, CustomerGroup>();

    for (const invoice of invoices) {
      const key = invoice.customer.id;
      if (!map.has(key)) {
        map.set(key, {
          customerId: invoice.customer.id,
          customerName: invoice.customer.name,
          customerEmail: invoice.customer.email,
          invoices: [],
          totalAmount: 0,
          invoiceCount: 0,
        });
      }
      const group = map.get(key)!;
      group.invoices.push(invoice);
      group.totalAmount += Number(invoice.amount);
      group.invoiceCount += 1;
    }

    return Array.from(map.values()).sort((a, b) =>
      a.customerName.localeCompare(b.customerName)
    );
  }, [invoices]);

  const firstCustomerId = groups.length > 0 ? groups[0].customerId : null;

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set(firstCustomerId ? [firstCustomerId] : [])
  );

  const toggleGroup = (customerId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) {
        next.delete(customerId);
      } else {
        next.add(customerId);
      }
      return next;
    });
  };

  if (invoices.length === 0) {
    return (
      <tbody className="bg-white divide-y divide-gray-200">
        <tr>
          <td colSpan={6} className="p-0">
            <EmptyState
              icon={<FileText className="w-16 h-16" />}
              title="Nenhuma fatura encontrada"
              description="Tente ajustar seus filtros ou crie uma nova fatura para começar."
            />
          </td>
        </tr>
      </tbody>
    );
  }

  return (
    <tbody className="bg-white divide-y divide-gray-200">
      {groups.map((group) => {
        const isExpanded = expandedGroups.has(group.customerId);

        return (
          <>
            {/* Group header row */}
            <tr
              key={`group-${group.customerId}`}
              className="bg-gray-100 border-t-2 border-gray-300 cursor-pointer hover:bg-gray-200 transition-colors"
              onClick={() => toggleGroup(group.customerId)}
            >
              <td colSpan={6} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={isExpanded ? "Recolher grupo" : "Expandir grupo"}
                      className="p-0.5 rounded text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(group.customerId);
                      }}
                    >
                      <ChevronRight
                        className={`w-4 h-4 transition-transform duration-200 ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </button>
                    <span className="text-sm font-display font-semibold text-gray-900">
                      {group.customerName}
                    </span>
                    <span className="text-xs text-gray-500">
                      {group.customerEmail}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="font-display">
                      {group.invoiceCount}{" "}
                      {group.invoiceCount !== 1 ? "faturas" : "fatura"}
                    </span>
                    <span className="font-display font-semibold text-gray-900 tabular-nums">
                      $
                      {group.totalAmount.toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>
              </td>
            </tr>

            {/* Invoice rows (only when expanded) */}
            {isExpanded &&
              group.invoices.map((invoice) => {
                const isOverdue =
                  invoice.status !== InvoiceStatus.PAID &&
                  invoice.status !== InvoiceStatus.VOID &&
                  new Date(invoice.dueDate) < new Date();

                const isPaidOrVoid =
                  invoice.status === InvoiceStatus.PAID ||
                  invoice.status === InvoiceStatus.VOID;

                const canEditInvoice =
                  (userRole === "ADMIN" ||
                    userRole === "FINANCE" ||
                    (["COMMERCIAL", "SALES"].includes(userRole) &&
                      invoice.ownerId === userId)) &&
                  !isPaidOrVoid;

                return (
                  <tr
                    key={invoice.id}
                    className={`hover:bg-gray-50 transition-colors${isOverdue ? " bg-red-50" : ""}`}
                  >
                    {/* Invoice number — indented */}
                    <td className="pl-10 pr-6 py-4 whitespace-nowrap">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="text-sm font-display font-medium text-gold-600 hover:text-gold-700"
                      >
                        {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                      </Link>
                    </td>

                    {/* Customer name (subtle, already in group header) */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-display text-gray-500">
                        {invoice.customer.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {invoice.customer.email}
                      </div>
                    </td>

                    {/* Amount */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-display font-semibold text-gray-900 tabular-nums">
                      $
                      {Number(invoice.amount).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>

                    {/* Status badge */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={getStatusVariant(invoice.status)}>
                        {invoice.status}
                      </Badge>
                    </td>

                    {/* Due date */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 tabular-nums">
                      {format(new Date(invoice.dueDate), "MMM dd, yyyy")}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/dashboard/invoices/${invoice.id}`}
                          className="text-gold-600 hover:text-gold-700 font-medium"
                        >
                          Ver
                        </Link>
                        {canEditInvoice && (
                          <Link
                            href={`/dashboard/invoices/${invoice.id}/edit`}
                            className="text-gold-600 hover:text-gold-700 font-medium"
                          >
                            Editar
                          </Link>
                        )}
                        <DeleteInvoiceButton
                          invoiceId={invoice.id}
                          invoiceNumber={
                            invoice.invoiceNumber || invoice.id.slice(0, 8)
                          }
                          hasQuickbooksId={!!invoice.quickbooks_invoice_id}
                          userRole={userRole}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
          </>
        );
      })}
    </tbody>
  );
}
