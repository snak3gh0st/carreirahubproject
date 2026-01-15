"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TopCustomerData {
  id: string;
  name: string;
  email: string;
  totalPaid: number;
}

interface TopCustomersChartProps {
  data: TopCustomerData[];
}

/**
 * Top Customers Bar Chart
 *
 * Displays top 10 customers by revenue with horizontal bars.
 */
export function TopCustomersChart({ data }: TopCustomersChartProps) {
  // Format data for Recharts (truncate long names)
  const chartData = data.map((customer) => ({
    name:
      customer.name.length > 20
        ? customer.name.substring(0, 20) + "..."
        : customer.name,
    fullName: customer.name,
    email: customer.email,
    revenue: customer.totalPaid,
  }));

  // Format Y-axis to show currency
  const formatYAxis = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  };

  // Custom tooltip to show full customer info
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-slate-800 p-3 border border-gray-200 dark:border-gray-700 rounded shadow-lg">
          <p className="font-semibold text-gray-900 dark:text-white">
            {data.fullName}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            {data.email}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Revenue: ${data.revenue.toLocaleString()}
          </p>
        </div>
      );
    }
    return null;
  };

  // If no data, show empty state
  if (!data || data.length === 0) {
    return (
      <div className="h-[400px] flex items-center justify-center text-gray-500 dark:text-gray-400">
        No customer data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart
        data={chartData}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
        <XAxis
          dataKey="name"
          className="text-xs text-gray-600 dark:text-gray-400"
          angle={-45}
          textAnchor="end"
          height={100}
        />
        <YAxis
          tickFormatter={formatYAxis}
          className="text-xs text-gray-600 dark:text-gray-400"
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
