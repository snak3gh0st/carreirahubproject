"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
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

  const totalAmount = data.reduce((sum, item) => sum + item.amount, 0);

  return (
    <ResponsiveContainer width="100%" height={300}>
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
          label={({ status, percent }) =>
            `${status} (${(percent * 100).toFixed(0)}%)`
          }
          labelLine={false}
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
            `${formatCurrency(value)} (${props.payload.count} invoices)`,
            "Amount",
          ]}
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        />
        <Legend
          formatter={(value, entry: any) => {
            const item = data.find((d) => d.status === value);
            const percent = item ? ((item.amount / totalAmount) * 100).toFixed(1) : "0";
            return `${value} (${percent}%)`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
