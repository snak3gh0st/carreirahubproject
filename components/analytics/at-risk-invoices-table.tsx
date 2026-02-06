"use client";

import { format } from "date-fns";
import { AlertTriangle, TrendingDown, XCircle } from "lucide-react";

interface AtRiskInvoice {
  invoiceId: string;
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  amount: number;
  dueDate: Date;
  daysOverdue: number;
  status: string;
  predictedPaymentDate: Date;
  collectionProbability: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reasonForRisk: string[];
}

interface AtRiskInvoicesTableProps {
  data: AtRiskInvoice[];
  isLoading?: boolean;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const getRiskBadge = (riskLevel: string) => {
  switch (riskLevel) {
    case "CRITICAL":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
          <XCircle className="w-3 h-3" />
          Critical
        </span>
      );
    case "HIGH":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-orange-100 text-orange-800 rounded-full">
          <AlertTriangle className="w-3 h-3" />
          High
        </span>
      );
    case "MEDIUM":
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
          <TrendingDown className="w-3 h-3" />
          Medium
        </span>
      );
    default:
      return (
        <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
          Low
        </span>
      );
  }
};

export function AtRiskInvoicesTable({
  data,
  isLoading,
}: AtRiskInvoicesTableProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-lg p-8 animate-pulse">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-200 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-gray-50 rounded-lg">
        <div className="text-gray-400 mb-2">No at-risk invoices</div>
        <div className="text-sm text-gray-500">
          All invoices have good collection probability
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Invoice
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Customer
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Amount
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Due Date
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risk Level
            </th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              Collection %
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Risk Factors
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((invoice) => (
            <tr
              key={invoice.invoiceId}
              className="hover:bg-gray-50 transition-colors"
            >
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">
                  {invoice.invoiceNumber || invoice.invoiceId.slice(0, 8)}
                </div>
                <div className="text-xs text-gray-500">{invoice.status}</div>
              </td>
              <td className="px-4 py-4">
                <div className="text-sm text-gray-900">
                  {invoice.customerName}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {formatCurrency(invoice.amount)}
                </div>
              </td>
              <td className="px-4 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {format(new Date(invoice.dueDate), "MMM d, yyyy")}
                </div>
                {invoice.daysOverdue > 0 && (
                  <div className="text-xs text-red-600 font-medium">
                    {invoice.daysOverdue} days overdue
                  </div>
                )}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
                {getRiskBadge(invoice.riskLevel)}
              </td>
              <td className="px-4 py-4 whitespace-nowrap text-center">
                <div className="flex items-center justify-center gap-2">
                  <div
                    className={`text-sm font-semibold ${
                      invoice.collectionProbability >= 60
                        ? "text-green-600"
                        : invoice.collectionProbability >= 40
                        ? "text-yellow-600"
                        : "text-red-600"
                    }`}
                  >
                    {invoice.collectionProbability}%
                  </div>
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        invoice.collectionProbability >= 60
                          ? "bg-green-500"
                          : invoice.collectionProbability >= 40
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }`}
                      style={{
                        width: `${invoice.collectionProbability}%`,
                      }}
                    />
                  </div>
                </div>
              </td>
              <td className="px-4 py-4">
                <div className="space-y-1">
                  {invoice.reasonForRisk.map((reason, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-gray-600 flex items-center gap-1"
                    >
                      <span className="w-1 h-1 bg-gray-400 rounded-full" />
                      {reason}
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary Footer */}
      <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="text-gray-600">
            Showing {data.length} at-risk invoice{data.length !== 1 ? "s" : ""}
          </div>
          <div className="text-gray-900 font-semibold">
            Total at risk: {formatCurrency(data.reduce((sum, inv) => sum + inv.amount, 0))}
          </div>
        </div>
      </div>
    </div>
  );
}
