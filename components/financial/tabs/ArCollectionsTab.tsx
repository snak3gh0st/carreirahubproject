"use client";

import { ArCollectionsData } from "@/lib/types/financial-bi";
import { buildCollectionComparisonSummaries } from "@/lib/financial/ar-collections-helpers";
import {
  BarChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell, ComposedChart,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

interface ArCollectionsTabProps { data: ArCollectionsData; }

const agingColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444", "#991b1b"];

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

export function ArCollectionsTab({ data }: ArCollectionsTabProps) {
  const latestCollectedPerformance = [...data.collectionPerformance].reverse().find((point) => point.collected > 0)
    || data.collectionPerformance[data.collectionPerformance.length - 1];
  const avgCollectionRate = data.collectionPerformance.length > 0
    ? data.collectionPerformance.reduce((sum, point) => sum + point.collectionRate, 0) / data.collectionPerformance.length
    : 0;
  const avgDays = data.collectionPerformance.filter((point) => point.avgDaysToPayment !== null);
  const rollingAvgDays = avgDays.length > 0
    ? avgDays.reduce((sum, point) => sum + (point.avgDaysToPayment || 0), 0) / avgDays.length
    : 0;
  const comparisonSummaries = buildCollectionComparisonSummaries(data.collectionPerformance);
  const summary2025 = comparisonSummaries.find((summary) => summary.year === "2025");
  const summary2026 = comparisonSummaries.find((summary) => summary.year === "2026");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Latest booked month</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{formatK(latestCollectedPerformance?.invoiced || 0)}</div>
          <div className="text-xs text-gray-500">Invoiced in the latest month with relevant activity</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Latest collected cash</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-verde">{formatK(latestCollectedPerformance?.collected || 0)}</div>
          <div className="text-xs text-gray-500">Cash collected in the same comparison month</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Avg collection rate</div>
          <div className="mt-1 text-2xl font-extrabold text-amber-600">{avgCollectionRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">Collected divided by invoiced across the visible 2025-2026 cohort months</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Avg days to payment</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{rollingAvgDays.toFixed(0)}d</div>
          <div className="text-xs text-gray-500">Weighted by actual payment records, from QuickBooks booking date to payment date</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">2025 baseline</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">{summary2025 ? `${summary2025.avgCollectionRate.toFixed(1)}%` : "—"}</div>
          <div className="text-xs text-gray-500">
            {summary2025?.avgDaysToPayment != null ? `${summary2025.avgDaysToPayment.toFixed(0)}d avg pay speed` : "No payment sample"}
          </div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">2026 YTD</div>
          <div className="mt-1 text-2xl font-extrabold text-slate-900">{summary2026 ? `${summary2026.avgCollectionRate.toFixed(1)}%` : "—"}</div>
          <div className="text-xs text-gray-500">
            {summary2026?.avgDaysToPayment != null ? `${summary2026.avgDaysToPayment.toFixed(0)}d avg pay speed` : "No payment sample"}
          </div>
        </div>
      </div>
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
          <CardHeader>
            <CardTitle className="text-sm">Cash Movement by Booked Month</CardTitle>
            <p className="text-xs text-gray-500">This answers how much each booked cohort generated and how much cash actually came in during each calendar month.</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <ComposedChart data={data.collectionPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(value) => {
                    const [year, month] = String(value).split("-");
                    return `${month}/${year.slice(2)}`;
                  }}
                  minTickGap={20}
                />
                <YAxis yAxisId="cash" tick={{ fontSize: 11 }} tickFormatter={formatK} />
                <Tooltip formatter={(value: number, name: string) => {
                  return [formatK(value), name];
                }} labelFormatter={(value) => {
                  const [year, month] = String(value).split("-");
                  return `${month}/${year}`;
                }} />
                <Legend />
                <Bar yAxisId="cash" dataKey="invoiced" name="Invoiced" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="cash" dataKey="collected" name="Collected" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Collection Efficiency and Payment Speed</CardTitle>
          <p className="text-xs text-gray-500">This separates cohort effectiveness from cash timing. Orange is how much of each booked cohort has been collected so far. Red is the weighted average days between invoice booking and actual payment records.</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={290}>
            <ComposedChart data={data.collectionPerformance}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickFormatter={(value) => {
                  const [year, month] = String(value).split("-");
                  return `${month}/${year.slice(2)}`;
                }}
                minTickGap={20}
              />
              <YAxis yAxisId="rate" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}%`} domain={[0, 100]} />
              <YAxis yAxisId="days" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}d`} />
              <Tooltip formatter={(value: number, name: string) => {
                if (name === "Avg Days to Pay") return [value == null ? "No payment sample" : `${value.toFixed(0)}d`, name];
                if (name === "Collection Rate %") return [`${value.toFixed(1)}%`, name];
                return [String(value), name];
              }} labelFormatter={(value) => {
                const [year, month] = String(value).split("-");
                return `${month}/${year}`;
              }} />
              <Legend />
              <Line yAxisId="rate" type="monotone" dataKey="collectionRate" name="Collection Rate %" stroke="#f97316" strokeWidth={3} dot={{ r: 3 }} />
              <Line yAxisId="days" type="monotone" connectNulls={false} dataKey="avgDaysToPayment" name="Avg Days to Pay" stroke="#ef4444" strokeWidth={2.5} dot={{ r: 2 }} strokeDasharray="5 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
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
