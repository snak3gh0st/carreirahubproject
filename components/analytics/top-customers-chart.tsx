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

interface TopCustomersChartProps {
  data: Array<{
    name: string;
    revenue: number;
  }>;
  isLoading?: boolean;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const truncateName = (name: string, maxLength: number = 20): string => {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + "...";
};

export function TopCustomersChart({ data, isLoading }: TopCustomersChartProps) {
  if (isLoading) {
    return (
      <div className="h-80 bg-gray-100 animate-pulse rounded-lg" />
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex flex-col items-center justify-center text-gray-500">
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
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-700 mb-1">Nenhum dado de cliente disponível</p>
        <p className="text-sm text-gray-500">Tente ajustar o filtro de período</p>
      </div>
    );
  }

  // Truncate names for display
  const chartData = data.map(item => ({
    ...item,
    displayName: truncateName(item.name, 20),
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 80, left: 20, bottom: 5 }}
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
          dataKey="displayName"
          width={120}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <Tooltip
          formatter={(value: number, name: string, props: any) => [
            formatCurrency(value),
            props.payload.name
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
          dataKey="revenue"
          name="Receita"
          fill="#0F52BA"
          radius={[0, 4, 4, 0]}
        >
          <LabelList
            dataKey="revenue"
            position="right"
            formatter={(value: number) => formatCurrency(value)}
            style={{ fontSize: 11, fill: "#6b7280" }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
