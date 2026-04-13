"use client";

import { CashFlowData } from "@/lib/types/financial-bi";
import {
  AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CashFlowTabProps { data: CashFlowData; }

const probColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444"];

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

const riskBadge: Record<string, string> = {
  LOW: "bg-green-100 text-green-700", MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700", CRITICAL: "bg-red-100 text-red-700",
};

export function CashFlowTab({ data }: CashFlowTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Cash Flow Forecast (90 days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Legend />
                <Area type="monotone" dataKey="optimistic" name="Optimistic" stroke="#86efac" fill="#dcfce7" strokeWidth={1} />
                <Area type="monotone" dataKey="expected" name="Expected" stroke="#22c55e" fill="#bbf7d0" strokeWidth={2} />
                <Area type="monotone" dataKey="conservative" name="Conservative" stroke="#166534" fill="#f0fdf4" strokeWidth={1} strokeDasharray="5 5" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Payment Probability Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={data.probabilityBreakdown.filter((s) => s.amount > 0)} dataKey="amount" nameKey="segment" cx="50%" cy="50%" innerRadius={50} outerRadius={90}>
                  {data.probabilityBreakdown.map((_, i) => (<Cell key={i} fill={probColors[i] || "#94a3b8"} />))}
                </Pie>
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">At-Risk Invoices ({data.atRiskInvoices.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Due Date</th>
                  <th className="pb-2 pr-3 text-right">Days Overdue</th>
                  <th className="pb-2 pr-3 text-right">Probability</th>
                  <th className="pb-2 pr-3">Risk</th>
                  <th className="pb-2">Last Action</th>
                </tr>
              </thead>
              <tbody>
                {data.atRiskInvoices.slice(0, 15).map((inv) => (
                  <tr key={inv.id} className={`border-b hover:bg-gray-50 ${inv.riskLevel === "CRITICAL" ? "bg-red-50" : ""}`}>
                    <td className="py-2 pr-3 font-medium">{inv.customerName}</td>
                    <td className="py-2 pr-3 text-right font-semibold">${inv.amount.toLocaleString()}</td>
                    <td className="py-2 pr-3">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 text-right">{inv.daysOverdue}d</td>
                    <td className="py-2 pr-3 text-right">{inv.probability}%</td>
                    <td className="py-2 pr-3">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${riskBadge[inv.riskLevel]}`}>{inv.riskLevel}</span>
                    </td>
                    <td className="py-2 text-gray-500">{inv.lastAction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
