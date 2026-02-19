"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
  hasOverdue: boolean;
  earliestOverdueDate: Date | null;
}

interface InvoiceGroupedListProps {
  invoices: Invoice[];
  userRole: string;
  userId: string;
  sortBy?: string;
  sortOrder?: string;
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

function SortIndicator({ field, sortBy, sortOrder }: { field: string; sortBy?: string; sortOrder?: string }) {
  if (sortBy !== field) return null;
  return <>{sortOrder === "asc" ? " ↑" : " ↓"}</>;
}

export function InvoiceGroupedList({
  invoices,
  userRole,
  userId,
  sortBy,
  sortOrder,
}: InvoiceGroupedListProps) {
  const searchParams = useSearchParams();

  const buildSortUrl = (field: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sortBy", field);
    params.set("sortOrder", sortBy === field && sortOrder === "asc" ? "desc" : "asc");
    return `/dashboard/invoices?${params.toString()}`;
  };
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
          hasOverdue: false,
          earliestOverdueDate: null,
        });
      }
      const group = map.get(key)!;
      group.invoices.push(invoice);
      group.totalAmount += Number(invoice.amount);
      group.invoiceCount += 1;

      const invoiceDue = new Date(invoice.dueDate);
      const isInvoiceOverdue =
        invoice.status !== InvoiceStatus.PAID &&
        invoice.status !== InvoiceStatus.VOID &&
        invoiceDue < new Date();

      if (isInvoiceOverdue) {
        group.hasOverdue = true;
        if (
          group.earliestOverdueDate === null ||
          invoiceDue < group.earliestOverdueDate
        ) {
          group.earliestOverdueDate = invoiceDue;
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.customerName.localeCompare(b.customerName)
    );
  }, [invoices]);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    () => new Set()
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

  const expandAll = () =>
    setExpandedGroups(new Set(groups.map((g) => g.customerId)));

  const collapseAll = () => setExpandedGroups(new Set());

  const allExpanded = groups.length > 0 && expandedGroups.size === groups.length;
  const anyExpanded = expandedGroups.size > 0;

  if (invoices.length === 0) {
    return (
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Fatura #
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Valor
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Data
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Ações
              </th>
            </tr>
          </thead>
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
        </table>
      </div>
    );
  }

  return (
    <div>
      {/* Expand / Collapse All toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-gray-50">
        <span className="text-xs text-gray-500 font-display">
          {groups.length} {groups.length !== 1 ? "clientes" : "cliente"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            disabled={allExpanded}
            className="px-3 py-1 text-xs font-display font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Expandir tudo
          </button>
          <button
            type="button"
            onClick={collapseAll}
            disabled={!anyExpanded}
            className="px-3 py-1 text-xs font-display font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Recolher tudo
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                <Link href={buildSortUrl("invoiceNumber")} className="hover:text-gray-900 cursor-pointer">
                  Fatura #<SortIndicator field="invoiceNumber" sortBy={sortBy} sortOrder={sortOrder} />
                </Link>
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Cliente
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                <Link href={buildSortUrl("amount")} className="hover:text-gray-900 cursor-pointer">
                  Valor<SortIndicator field="amount" sortBy={sortBy} sortOrder={sortOrder} />
                </Link>
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                <Link href={buildSortUrl("dueDate")} className="hover:text-gray-900 cursor-pointer">
                  Data<SortIndicator field="dueDate" sortBy={sortBy} sortOrder={sortOrder} />
                </Link>
              </th>
              <th className="px-6 py-3 text-left text-xs font-display font-medium text-gray-700 uppercase tracking-wide">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.customerId);

              return (
                <>
                  {/* Group header row */}
                  <tr
                    key={`group-${group.customerId}`}
                    className={`border-t-2 cursor-pointer transition-colors ${
                      group.hasOverdue
                        ? "bg-red-50 border-red-200 hover:bg-red-100"
                        : "bg-gray-100 border-gray-300 hover:bg-gray-200"
                    }`}
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
                          {group.hasOverdue && group.earliestOverdueDate && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-display font-semibold bg-red-100 text-red-700 border border-red-200">
                              Vencido {format(group.earliestOverdueDate, "dd/MM/yy")}
                            </span>
                          )}
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
                          <td className="pl-10 pr-6 py-4 whitespace-nowrap">
                            <Link
                              href={`/dashboard/invoices/${invoice.id}`}
                              className="text-sm font-display font-medium text-gold-600 hover:text-gold-700"
                            >
                              {invoice.invoiceNumber || invoice.id.slice(0, 8)}
                            </Link>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-display text-gray-500">
                              {invoice.customer.name}
                            </div>
                            <div className="text-xs text-gray-400">
                              {invoice.customer.email}
                            </div>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm font-display font-semibold text-gray-900 tabular-nums">
                            $
                            {Number(invoice.amount).toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap">
                            <Badge variant={getStatusVariant(invoice.status)}>
                              {invoice.status}
                            </Badge>
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 tabular-nums">
                            {format(new Date(invoice.dueDate), "MMM dd, yyyy")}
                          </td>

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
        </table>
      </div>
    </div>
  );
}
