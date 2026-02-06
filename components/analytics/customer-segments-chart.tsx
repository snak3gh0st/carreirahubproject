"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
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

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div className="h-[240px] flex flex-col items-center justify-center text-gray-500">
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
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
        <p className="text-lg font-medium text-gray-700 mb-1">Nenhum dado de segmento disponível</p>
        <p className="text-sm text-gray-500">Tente ajustar o filtro de período</p>
      </div>
    );
  }

  const totalCustomers = data.reduce((sum, item) => sum + item.count, 0);
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="flex items-start gap-6">
      {/* Donut Chart */}
      <div className="flex-shrink-0" style={{ width: "240px", height: "240px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="revenue"
              nameKey="segment"
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
                `${formatCurrency(value)} (${props.payload.count} clientes)`,
                "Receita",
              ]}
              contentStyle={{
                backgroundColor: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Table */}
      <div className="flex-1 min-w-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="text-left py-2 font-medium text-gray-700">Segmento</th>
              <th className="text-right py-2 font-medium text-gray-700">Quantidade</th>
              <th className="text-right py-2 font-medium text-gray-700">Receita</th>
              <th className="text-right py-2 font-medium text-gray-700">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, index) => {
              const percent = ((item.revenue / totalRevenue) * 100).toFixed(1);
              return (
                <tr key={index} className="border-b border-gray-100">
                  <td className="py-2 flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ backgroundColor: SEGMENT_COLORS[item.segment] || "#6b7280" }}
                    />
                    <span className="text-gray-900">{item.segment}</span>
                  </td>
                  <td className="py-2 text-right text-gray-600">{item.count}</td>
                  <td className="py-2 text-right text-gray-900 font-medium">
                    {formatCurrency(item.revenue)}
                  </td>
                  <td className="py-2 text-right text-gray-600">{percent}%</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 font-semibold">
              <td className="py-2 text-gray-900">Total</td>
              <td className="py-2 text-right text-gray-900">{totalCustomers}</td>
              <td className="py-2 text-right text-gray-900">{formatCurrency(totalRevenue)}</td>
              <td className="py-2 text-right text-gray-900">100%</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
