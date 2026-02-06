"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface RevenueTrendChartProps {
  data: Array<{
    month: string;
    revenue: number;
    invoices: number;
  }>;
  isLoading?: boolean;
}

// Format currency
const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function RevenueTrendChart({ data, isLoading }: RevenueTrendChartProps) {
  if (isLoading) {
    return (
      <div className="h-80 bg-gray-100 animate-pulse rounded-lg" />
    );
  }

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="h-[350px] flex flex-col items-center justify-center text-gray-500">
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
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-700 mb-1">Nenhum dado de receita disponível</p>
        <p className="text-sm text-gray-500">Tente ajustar o filtro de período</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <Tooltip
          formatter={(value: number) => formatCurrency(value)}
          contentStyle={{
            backgroundColor: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          }}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="revenue"
          name="Receita"
          stroke="#0F52BA"
          strokeWidth={2}
          dot={{ fill: "#0F52BA", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: "#0F52BA" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
