"use client";

import { RevenueGrowthData } from "@/lib/types/financial-bi";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RevenueGrowthTabProps { data: RevenueGrowthData; }

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

export function RevenueGrowthTab({ data }: RevenueGrowthTabProps) {
  const latestMrr = data.mrrTrend[data.mrrTrend.length - 1];
  const latestRevenue = data.invoicedVsCollected[data.invoicedVsCollected.length - 1];
  const totalInvoiced = data.invoicedVsCollected.reduce((sum, point) => sum + point.invoiced, 0);
  const totalCollected = data.invoicedVsCollected.reduce((sum, point) => sum + point.collected, 0);
  const realizedRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;
  const topProgram = data.revenueByService[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Selected cash revenue</div>
          <div className="mt-1 text-2xl font-extrabold text-brand-verde">{formatK(totalCollected)}</div>
          <div className="text-xs text-gray-500">Collected across the visible trend window</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Selected invoiced</div>
          <div className="mt-1 text-2xl font-extrabold text-gray-900">{formatK(totalInvoiced)}</div>
          <div className="text-xs text-gray-500">Booked invoices in the same months</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Realization rate</div>
          <div className="mt-1 text-2xl font-extrabold text-amber-600">{realizedRate.toFixed(1)}%</div>
          <div className="text-xs text-gray-500">Collected divided by invoiced</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">MRR smoothed</div>
          <div className="mt-1 text-2xl font-extrabold text-violet-600">{formatK(latestMrr?.mrr || 0)}</div>
          <div className="text-xs text-gray-500">3-month trailing average</div>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <div className="text-[10px] uppercase tracking-wide text-gray-500">Top program</div>
          <div className="mt-1 text-lg font-extrabold text-gray-900">{topProgram?.service || "—"}</div>
          <div className="text-xs text-gray-500">{topProgram ? `${formatK(topProgram.amount)} in revenue` : "No dominant program"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Invoiced vs Collected</CardTitle>
          <p className="text-xs text-gray-500">Invoiced uses the QuickBooks invoice posting month when available, not local import timestamps.</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={data.invoicedVsCollected}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Legend />
              <Area type="monotone" dataKey="invoiced" name="Invoiced" stroke="#94a3b8" fill="#f1f5f9" strokeWidth={2} />
              <Area type="monotone" dataKey="collected" name="Collected" stroke="#22c55e" fill="#dcfce7" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Revenue by Program</CardTitle>
          <p className="text-xs text-gray-500">Entry payments and installments are folded back into the underlying program instead of being treated as standalone services.</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.revenueByService} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="service" tick={{ fontSize: 11 }} width={150} />
              <Tooltip formatter={(v: number, key, item) => key === "amount" ? [formatK(v), "Revenue"] : [String(v), "Invoices"]} />
              <Bar dataKey="amount" fill="var(--brand-tangerina)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">MRR / ARR Trend</CardTitle>
          <p className="text-xs text-gray-500">
            Smoothed with a 3-month trailing average so the current partial month does not collapse the line.
            {latestMrr ? ` Latest actual: ${formatK(latestMrr.actualMrr)}.` : ""}
            {latestRevenue ? ` Latest invoiced: ${formatK(latestRevenue.invoiced)}.` : ""}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.mrrTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Legend />
              <Line type="monotone" dataKey="actualMrr" name="Actual MRR" stroke="#94a3b8" strokeWidth={1.5} dot={false} strokeDasharray="5 4" />
              <Line type="monotone" dataKey="mrr" name="MRR (3-mo avg)" stroke="#8b5cf6" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">Month-over-Month Growth</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.momGrowth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${v.toFixed(0)}%`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
              <ReferenceLine y={0} stroke="#94a3b8" />
              <Bar dataKey="growthPct" name="Growth %">
                {data.momGrowth.map((entry, i) => (
                  <Cell key={i} fill={entry.growthPct >= 0 ? "#22c55e" : "#ef4444"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
