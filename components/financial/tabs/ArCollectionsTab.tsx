"use client";

import { ArCollectionsData } from "@/lib/types/financial-bi";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface ArCollectionsTabProps { data: ArCollectionsData; }

const agingColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444", "#991b1b"];

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

export function ArCollectionsTab({ data }: ArCollectionsTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">AR Aging Breakdown</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.agingBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                  {data.agingBreakdown.map((_, i) => (
                    <Cell key={i} fill={agingColors[i] || "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 grid grid-cols-5 gap-2 text-center text-[10px]">
              {data.agingBreakdown.map((b, i) => (
                <div key={b.bucket}>
                  <div className="font-bold" style={{ color: agingColors[i] }}>{b.bucket}</div>
                  <div className="text-gray-600">{b.count} inv</div>
                  <div className="font-semibold">{formatK(b.amount)}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Collection Performance</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={data.collectionPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="days" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="rate" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} />
                <Tooltip />
                <Legend />
                <Line yAxisId="days" type="monotone" dataKey="avgDaysToPayment" name="Avg Days to Pay" stroke="#ef4444" strokeWidth={2} dot={false} />
                <Line yAxisId="rate" type="monotone" dataKey="collectionRate" name="Collection Rate %" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-sm">Overdue Invoices ({data.overdueInvoices.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-3">Customer</th>
                  <th className="pb-2 pr-3">Invoice #</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 pr-3">Due Date</th>
                  <th className="pb-2 pr-3 text-right">Days Overdue</th>
                  <th className="pb-2 pr-3 text-right">Reminders</th>
                  <th className="pb-2 pr-3 text-right">Calls</th>
                  <th className="pb-2 pr-3">Auto-Charge</th>
                  <th className="pb-2">Owner</th>
                </tr>
              </thead>
              <tbody>
                {data.overdueInvoices.slice(0, 20).map((inv) => (
                  <tr key={inv.id} className={`border-b hover:bg-gray-50 ${inv.daysOverdue > 45 ? "bg-red-50" : ""}`}>
                    <td className="py-2 pr-3 font-medium">{inv.customerName}</td>
                    <td className="py-2 pr-3">
                      <Link href={`/dashboard/invoices?id=${inv.id}`} className="text-brand-tangerina hover:underline">{inv.invoiceNumber}</Link>
                    </td>
                    <td className="py-2 pr-3 text-right font-semibold">${inv.amount.toLocaleString()}</td>
                    <td className="py-2 pr-3">{new Date(inv.dueDate).toLocaleDateString()}</td>
                    <td className="py-2 pr-3 text-right">
                      <span className={inv.daysOverdue > 45 ? "font-bold text-red-600" : inv.daysOverdue > 30 ? "text-amber-600" : "text-gray-600"}>{inv.daysOverdue}d</span>
                    </td>
                    <td className="py-2 pr-3 text-right">{inv.remindersSent}</td>
                    <td className="py-2 pr-3 text-right">{inv.collectionCalls}</td>
                    <td className="py-2 pr-3">
                      {inv.autoChargeStatus === "FAILED" && <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700">Failed</span>}
                      {inv.autoChargeStatus === "SUCCESS" && <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">OK</span>}
                      {!inv.autoChargeStatus && <span className="text-gray-400">—</span>}
                    </td>
                    <td className="py-2">{inv.ownerName}</td>
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
