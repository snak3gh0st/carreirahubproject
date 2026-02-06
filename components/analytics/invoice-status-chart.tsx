"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface InvoiceStatusChartProps {
  data: Array<{
    status: string;
    count: number;
    amount: number;
  }>;
  isLoading?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#9ca3af",
  SENT: "#3b82f6",
  PAID: "#22c55e",
  OVERDUE: "#ef4444",
  VOID: "#6b7280",
  PARTIALLY_PAID: "#f59e0b",
  REFUNDED: "#8b5cf6",
  PARTIALLY_REFUNDED: "#a78bfa",
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function InvoiceStatusChart({ data, isLoading }: InvoiceStatusChartProps) {
  if (isLoading) {
    return (
      <div className="h-80 bg-gray-100 animate-pulse rounded-lg" />
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="h-[240px] flex flex-col items-center justify-center text-gray-500">
        <svg
          className="w-16 h-16 mb-4 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-700 mb-1">Nenhum dado de fatura disponível</p>
        <p className="text-sm text-gray-500">Tente ajustar o filtro de período</p>
      </div>
    );
  }

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);
  const totalCount = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <div className="flex items-start gap-6">
      {/* Donut Chart */}
      <div className="flex-shrink-0" style={{ width: "240px", height: "240px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="amount"
              nameKey="status"
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={STATUS_COLORS[entry.status] || "#6b7280"}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: any) => [
                `${formatCurrency(value)} (${props.payload.count} faturas)`,
                "Valor",
              ]}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Table */}
      <div className="flex-1 min-w-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 font-medium text-gray-700">Status</th>
              <th className="text-right py-2 font-medium text-gray-700">Quantidade</th>
              <th className="text-right py-2 font-medium text-gray-700">Valor</th>
              <th className="text-right py-2 font-medium text-gray-700">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => {
              const percent = ((item.amount / totalAmount) * 100).toFixed(1);
              return (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2 flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: STATUS_COLORS[item.status] || "#6b7280" }}
                    />
                    <span className="text-gray-900">{item.status}</span>
                  </td>
                  <td className="py-2 text-right text-gray-600">{item.count}</td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="py-2 text-right text-gray-600">{percent}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 text-gray-900">Total</td>
              <td className="py-2 text-right text-gray-900">{totalCount}</td>
              <td className="py-2 text-right text-gray-900">{formatCurrency(totalAmount)}</td>
              <td className="py-2 text-right text-gray-900">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
