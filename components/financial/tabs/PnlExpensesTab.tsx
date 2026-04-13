"use client";

import { PnLData } from "@/lib/types/financial-bi";
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PnlExpensesTabProps {
  data: PnLData;
}

function formatK(value: number): string {
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function PnlKpiCard({ title, value, prevValue, format: fmt }: {
  title: string; value: number; prevValue: number; format: "currency" | "percent" | "months";
}) {
  const changePct = prevValue !== 0 ? ((value - prevValue) / Math.abs(prevValue)) * 100 : 0;
  const display = fmt === "currency" ? formatK(value) : fmt === "percent" ? `${value.toFixed(1)}%` : `${value.toFixed(1)} mo`;
  const isPositive = fmt === "currency" ? value >= 0 : fmt === "months" ? value >= 6 : value >= 0;
  const changePrefix = changePct >= 0 ? "▲" : "▼";

  return (
    <div className={`rounded-lg border bg-white p-3 text-center ${isPositive ? "border-gray-100" : "border-red-200"}`}>
      <div className="text-[10px] uppercase text-gray-500">{title}</div>
      <div className={`mt-1 text-xl font-extrabold ${isPositive ? "text-success-600" : "text-error-600"}`}>{display}</div>
      {prevValue !== 0 && (
        <div className={`text-[11px] ${changePct >= 0 ? "text-success-600" : "text-error-600"}`}>
          {changePrefix} {Math.abs(changePct).toFixed(1)}% vs prior
        </div>
      )}
    </div>
  );
}

export function PnlExpensesTab({ data }: PnlExpensesTabProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <PnlKpiCard title="Total Revenue" value={data.totalRevenue} prevValue={data.prevTotalRevenue} format="currency" />
        <PnlKpiCard title="Total Expenses" value={data.totalExpenses} prevValue={data.prevTotalExpenses} format="currency" />
        <PnlKpiCard title="Net Income" value={data.netIncome} prevValue={data.prevNetIncome} format="currency" />
        <PnlKpiCard title="Net Margin" value={data.marginPct} prevValue={0} format="percent" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Monthly P&L Trend</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={data.monthlyPnL}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Legend />
                <Bar dataKey="revenue" name="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expenses" name="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs" name="COGS" fill="#f97316" radius={[4, 4, 0, 0]} />
                <Line type="monotone" dataKey="netIncome" name="Net Income" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Expense Breakdown by Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.expensesByCategory.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={130} />
                <Tooltip formatter={(v: number) => formatK(v)} />
                <Bar dataKey="amount" fill="#ef4444" radius={[0, 4, 4, 0]}>
                  {data.expensesByCategory.slice(0, 10).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#991b1b" : i < 3 ? "#ef4444" : "#f87171"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Burn Rate & Runway</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="text-3xl font-extrabold text-error-600">{formatK(data.burnRate)}<span className="text-base font-normal text-gray-500">/mo</span></div>
            <div className="text-xs text-gray-500">Monthly Burn Rate (avg last 3 months)</div>
            <div className="mt-4 text-2xl font-bold" style={{ color: data.runwayMonths < 3 ? "var(--error-600)" : data.runwayMonths < 6 ? "var(--warning-600)" : "var(--success-600)" }}>
              {data.runwayMonths >= 99 ? "∞" : `${data.runwayMonths.toFixed(1)}`}<span className="text-base font-normal text-gray-500"> months runway</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">Cash on Hand / Monthly Burn</div>
            {data.prevBurnRate > 0 && (
              <div className={`mt-3 text-xs ${data.burnRate > data.prevBurnRate ? "text-error-600" : "text-success-600"}`}>
                {data.burnRate > data.prevBurnRate ? "▲" : "▼"} {Math.abs(((data.burnRate - data.prevBurnRate) / data.prevBurnRate) * 100).toFixed(1)}% vs prior period
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Cash Position</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="text-3xl font-extrabold text-brand-verde">{formatK(data.cashOnHand)}</div>
            <div className="text-xs text-gray-500">Cash on Hand (from QuickBooks)</div>
            <div className="mt-4 text-xs text-gray-400">
              Last updated: {new Date(data.lastFetchedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
