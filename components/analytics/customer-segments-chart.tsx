"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface CustomerSegmentsChartProps {
  data: Array<{
    segment: string;
    count: number;
    revenue: number;
  }>;
  isLoading?: boolean;
}

const SEGMENT_COLORS: Record<string, string> = {
  "Premium ($10k+)": "#0F52BA",
  "High ($5k-10k)": "#3b82f6",
  "Medium ($1k-5k)": "#60a5fa",
  "Low (<$1k)": "#93c5fd",
};

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function CustomerSegmentsChart({ data, isLoading }: CustomerSegmentsChartProps) {
  if (isLoading) {
    return (
      <div className="h-80 bg-gray-100 animate-pulse rounded-lg" />
    );
  }

  const totalCustomers = data.reduce((sum, item) => sum + item.count, 0);

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
          dataKey="count"
          nameKey="segment"
          label={({ segment, percent }) =>
            `${segment.split(" ")[0]} (${(percent * 100).toFixed(0)}%)`
          }
          labelLine={false}
        >
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={SEGMENT_COLORS[entry.segment] || "#6b7280"}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string, props: any) => [
            `${value} customers (${formatCurrency(props.payload.revenue)} revenue)`,
            "Customers",
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
            const item = data.find((d) => d.segment === value);
            const count = item?.count || 0;
            return `${value} (${count})`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
