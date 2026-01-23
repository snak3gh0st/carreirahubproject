"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface InvoiceStatusData {
  status: string;
  count: number;
  value: number;
}

interface InvoiceStatusChartProps {
  data: InvoiceStatusData[];
}

// Color mapping for invoice statuses
const STATUS_COLORS: Record<string, string> = {
  PAID: "#10b981", // green
  SENT: "#3b82f6", // blue
  OVERDUE: "#ef4444", // red
  DRAFT: "#6b7280", // gray
  VOID: "#000000", // black
  PARTIALLY_PAID: "#f59e0b", // amber
  REFUNDED: "#8b5cf6", // purple
  PARTIALLY_REFUNDED: "#ec4899", // pink
};

/**
 * Invoice Status Distribution Pie Chart
 *
 * Displays invoice count and total value by status with color coding.
 */
export function InvoiceStatusChart({ data }: InvoiceStatusChartProps) {
  // Format data for Recharts
  const chartData = data.map((item) => ({
    name: item.status.replace(/_/g, " "), // Convert PARTIALLY_PAID to "PARTIALLY PAID"
    value: item.count,
    totalValue: item.value,
  }));

  // Custom tooltip to show count and value
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white">
          <p className="font-semibold text-gray-900">
            {data.name}
          </p>
          <p className="text-sm text-gray-600">
            Count: {data.value}
          </p>
          <p className="text-sm text-gray-600">
            Value: ${data.totalValue.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  // If no data, show empty state
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-gray-500">
        No invoice data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) =>
            `${name}: ${(percent * 100).toFixed(0)}%`
          }
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => {
            // Get original status (with underscores) to match color
            const originalStatus = data[index].status;
            const color = STATUS_COLORS[originalStatus] || "#6b7280";
            return <Cell key={`cell-${index}`} fill={color} />;
          })}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
