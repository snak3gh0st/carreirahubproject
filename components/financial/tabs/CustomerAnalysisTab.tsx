"use client";

import { CustomerAnalysisData } from "@/lib/types/financial-bi";
import {
  BarChart, Bar, PieChart, Pie, Cell, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CustomerAnalysisTabProps { data: CustomerAnalysisData; }

const segmentColors = ["#22c55e", "#f59e0b", "#ef4444"];

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

export function CustomerAnalysisTab({ data }: CustomerAnalysisTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Revenue Concentration</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <ComposedChart data={data.concentration.slice(0, 15)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="customer" tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={60} />
              <YAxis yAxisId="rev" tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" orientation="right" tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="var(--brand-tangerina)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="pct" type="monotone" dataKey="cumulativePct" name="Cumulative %" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Top 10 Customers by Revenue</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.topCustomers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="customer" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Bar dataKey="totalPaid" fill="var(--brand-verde)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Customer Segments</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={data.segments} dataKey="count" nameKey="segment" cx="50%" cy="50%" innerRadius={50} outerRadius={90} label={({ segment, count }) => `${segment}: ${count}`}>
                {data.segments.map((_, i) => (<Cell key={i} fill={segmentColors[i] || "#94a3b8"} />))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Customer Lifetime Value</CardTitle></CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6">
          <div className="text-3xl font-extrabold text-brand-verde">{formatK(data.ltv.average)}</div>
          <div className="text-xs text-gray-500">Average LTV</div>
          <div className="mt-3 text-lg font-bold text-gray-600">{formatK(data.ltv.median)}</div>
          <div className="text-xs text-gray-500">Median LTV</div>
          <div className="mt-2 text-[10px] text-gray-400">Median is more reliable — not skewed by large accounts</div>
        </CardContent>
      </Card>
    </div>
  );
}
