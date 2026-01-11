"use client"

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

interface ConversionFunnelProps {
  data: Array<{
    stage: string
    count: number
    percentage?: number
  }>
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  return (
    <div className="rounded-lg border p-6">
      <h3 className="text-lg font-semibold mb-4">Lead Conversion Funnel</h3>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="stage" stroke="#6b7280" />
            <YAxis stroke="#6b7280" />
            <Tooltip
              contentStyle={{ background: '#fff', border: '1px solid #e5e7eb' }}
            />
            <Legend />
            <Bar dataKey="count" fill="#2563eb" name="Leads" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-[300px] flex items-center justify-center text-gray-500">
          No data available
        </div>
      )}
    </div>
  )
}
