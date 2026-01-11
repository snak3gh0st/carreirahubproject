"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

interface InvoiceStatusChartProps {
  data: Array<{
    name: string
    value: number
  }>
}

const COLORS: Record<string, string> = {
  PAID: "#10b981",
  SENT: "#3b82f6",
  OVERDUE: "#ef4444",
  DRAFT: "#6b7280",
  PARTIALLY_PAID: "#f59e0b",
  VOID: "#8b5cf6",
}

export function InvoiceStatusChart({ data }: InvoiceStatusChartProps) {
  return (
    <div className="rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">Invoice Status Distribution</h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => `${name}: ${value}`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[entry.name] || "#3b82f6"} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-500">
          No data available
        </div>
      )}
    </div>
  )
}
