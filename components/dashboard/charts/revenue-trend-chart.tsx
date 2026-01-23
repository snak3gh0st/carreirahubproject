"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface RevenueTrendData {
  month: string;
  revenue: number;
}

interface RevenueTrendChartProps {
  data: RevenueTrendData[];
}

/**
 * Revenue Trend Line Chart
 *
 * Displays monthly revenue over the last 12 months with smooth curve.
 */
export function RevenueTrendChart({ data }: RevenueTrendChartProps) {
  // Format Y-axis to show currency
  const formatYAxis = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}k`;
    }
    return `$${value}`;
  };

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white">
          <p className="font-semibold text-gray-900">
            {data.month}
          </p>
          <p className="text-sm text-gray-600">
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
      <div className="h-[400px] flex items-center justify-center text-gray-500">
        No revenue data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={400}>
      <LineChart
        data={data}
        margin={{
          top: 5,
          right: 30,
          left: 20,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
        <XAxis
          dataKey="month"
          className="text-xs text-gray-600"
        />
        <YAxis
          tickFormatter={formatYAxis}
          className="text-xs text-gray-600"
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
