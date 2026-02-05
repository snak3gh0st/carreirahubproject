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

interface CustomerAcquisitionChartProps {
  data: Array<{
    month: string;
    new: number;
    active: number;
  }>;
  isLoading?: boolean;
}

export function CustomerAcquisitionChart({ data, isLoading }: CustomerAcquisitionChartProps) {
  if (isLoading) {
    return (
      <div className="h-80 bg-gray-100 animate-pulse rounded-lg" />
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickLine={false}
          axisLine={{ stroke: "#e5e7eb" }}
        />
        <Tooltip
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
          dataKey="new"
          name="New Customers"
          stroke="#0F52BA"
          strokeWidth={2}
          dot={{ fill: "#0F52BA", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: "#0F52BA" }}
        />
        <Line
          type="monotone"
          dataKey="active"
          name="Active Customers"
          stroke="#22c55e"
          strokeWidth={2}
          dot={{ fill: "#22c55e", strokeWidth: 2, r: 4 }}
          activeDot={{ r: 6, fill: "#22c55e" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
