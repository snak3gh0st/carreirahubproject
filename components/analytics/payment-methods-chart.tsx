"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

interface PaymentMethodsChartProps {
  data: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  isLoading?: boolean;
}

const METHOD_COLORS: Record<string, string> = {
  card: "#3b82f6",
  credit_card: "#3b82f6",
  bank: "#22c55e",
  bank_transfer: "#22c55e",
  cash: "#f59e0b",
  manual: "#6b7280",
  quickbooks: "#0F52BA",
  stripe: "#8b5cf6",
  other: "#9ca3af",
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatMethodName = (method: string): string => {
  return method
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

export function PaymentMethodsChart({ data, isLoading }: PaymentMethodsChartProps) {
  if (isLoading) {
    return (
      <div className="h-80 bg-gray-100 animate-pulse rounded-lg" />
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex flex-col items-center justify-center text-gray-500">
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
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-700 mb-1">Nenhum dado de pagamento disponível</p>
        <p className="text-sm text-gray-500">Tente ajustar o filtro de período</p>
      </div>
    );
  }

  // Format method names for display
  const chartData = data.map(item => ({
    ...item,
    displayMethod: formatMethodName(item.method),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 80, left: 100, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          type="category"
          dataKey="displayMethod"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <Tooltip
          formatter={(value: number, name: string, props: any) => [
            `${formatCurrency(value)} (${props.payload.count} pagamentos)`,
            "Valor"
          ]}
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        />
        <Legend />
        <Bar
          dataKey="amount"
          name="Valor"
          fill="#0F52BA"
          radius={[0, 4, 4, 0]}
        >
          <LabelList
            dataKey="amount"
            position="right"
            formatter={(value: number) => formatCurrency(value)}
            style={{ fontSize: 11, fill: "#6b7280" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
