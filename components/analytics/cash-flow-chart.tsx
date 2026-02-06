"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CashFlowChartProps {
  data: Array<{
    month: string;
    received: number;
    invoiced: number;
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

export function CashFlowChart({ data, isLoading }: CashFlowChartProps) {
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
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-700 mb-1">No cash flow data available</p>
        <p className="text-sm text-gray-500">Try adjusting your date range filter</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
        <Area
          type="monotone"
          dataKey="invoiced"
          name="Invoiced"
          stroke="#f97316"
          fill="#fed7aa"
          fillOpacity={0.6}
        />
        <Area
          type="monotone"
          dataKey="received"
          name="Received"
          stroke="#22c55e"
          fill="#86efac"
          fillOpacity={0.6}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
