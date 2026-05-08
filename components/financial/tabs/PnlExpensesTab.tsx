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
  const grossProfit = data.totalRevenue - data.totalCOGS;
  const grossMarginPct = data.totalRevenue > 0 ? (grossProfit / data.totalRevenue) * 100 : 0;
  const operatingExpenses = Math.max(data.totalExpenses - data.totalCOGS, 0);
  const operatingExpensePct = data.totalRevenue > 0 ? (operatingExpenses / data.totalRevenue) * 100 : 0;
  const cogsByCategory = data.cogsByCategory ?? [];
  const operatingCashFlow = data.operatingCashFlow || 0;
  const investingCashFlow = data.investingCashFlow || 0;
  const financingCashFlow = data.financingCashFlow || 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <PnlKpiCard title="Total Revenue" value={data.totalRevenue} prevValue={data.prevTotalRevenue} format="currency" />
        <PnlKpiCard title="COGS" value={data.totalCOGS} prevValue={0} format="currency" />
        <PnlKpiCard title="Gross Profit" value={grossProfit} prevValue={0} format="currency" />
        <PnlKpiCard title="Gross Margin" value={grossMarginPct} prevValue={0} format="percent" />
        <PnlKpiCard title="OpEx" value={operatingExpenses} prevValue={0} format="currency" />
        <PnlKpiCard title="Total Expenses" value={data.totalExpenses} prevValue={data.prevTotalExpenses} format="currency" />
        <PnlKpiCard title="Net Income" value={data.netIncome} prevValue={data.prevNetIncome} format="currency" />
        <PnlKpiCard title="Net Margin" value={data.marginPct} prevValue={0} format="percent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">COGS Breakdown</CardTitle>
          <p className="text-xs text-gray-500">Direct delivery costs from QuickBooks, separated from operating expenses.</p>
        </CardHeader>
        <CardContent>
          {cogsByCategory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50/40 p-4 text-sm text-orange-700">
              No COGS categories found in this window.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={cogsByCategory.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="category" tick={{ fontSize: 10 }} width={150} />
                  <Tooltip formatter={(v: number) => formatK(v)} />
                  <Bar dataKey="amount" fill="#f97316" radius={[0, 4, 4, 0]}>
                    {cogsByCategory.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={i === 0 ? "#c2410c" : i < 3 ? "#f97316" : "#fdba74"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {cogsByCategory.slice(0, 6).map((category) => (
                  <div key={category.category} className="rounded-lg border bg-orange-50/60 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">{category.category}</div>
                      <div className="text-sm font-bold text-gray-900">{formatK(category.amount)}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{category.pctOfTotal.toFixed(1)}% of COGS</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Monthly P&L Trend</CardTitle>
            <p className="text-xs text-gray-500">Revenue, COGS, expenses and net income across the QuickBooks reporting window.</p>
          </CardHeader>
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
          <CardHeader>
            <CardTitle className="text-sm">Expense Breakdown by Category</CardTitle>
            <p className="text-xs text-gray-500">Largest opex categories in the selected window, with share of total expense load.</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
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
              <div className="space-y-2">
                {data.expensesByCategory.slice(0, 6).map((category) => (
                  <div key={category.category} className="rounded-lg border bg-gray-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-gray-900">{category.category}</div>
                      <div className="text-sm font-bold text-gray-900">{formatK(category.amount)}</div>
                    </div>
                    <div className="mt-1 text-xs text-gray-500">{category.pctOfTotal.toFixed(1)}% of total expenses</div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-sm">Burn Rate & Runway</CardTitle></CardHeader>
          <CardContent className="flex flex-col items-center justify-center py-6">
            <div className="text-3xl font-extrabold text-error-600">{formatK(data.burnRate)}<span className="text-base font-normal text-gray-500">/mo</span></div>
            <div className="text-xs text-gray-500">Avg total monthly cost load from the last 3 closed months</div>
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
          <CardHeader>
            <CardTitle className="text-sm">Cash Position</CardTitle>
            <p className="text-xs text-gray-500">Balance sheet liquidity plus the cash-flow sections that explain movement in the period.</p>
          </CardHeader>
          <CardContent className="space-y-4 py-6">
            <div className="text-center">
              <div className="text-3xl font-extrabold text-brand-verde">{formatK(data.cashOnHand)}</div>
              <div className="text-xs text-gray-500">Cash on Hand (from QuickBooks)</div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-green-50 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-green-700">Operating CF</div>
                <div className="mt-1 text-lg font-bold text-green-800">{formatK(operatingCashFlow)}</div>
              </div>
              <div className="rounded-lg border bg-blue-50 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-blue-700">Investing CF</div>
                <div className="mt-1 text-lg font-bold text-blue-800">{formatK(investingCashFlow)}</div>
              </div>
              <div className="rounded-lg border bg-purple-50 p-3 text-center">
                <div className="text-[10px] uppercase tracking-wide text-purple-700">Financing CF</div>
                <div className="mt-1 text-lg font-bold text-purple-800">{formatK(financingCashFlow)}</div>
              </div>
            </div>
            <div className="rounded-lg border bg-gray-50 p-3 text-xs text-gray-600">
              Gross margin is {grossMarginPct.toFixed(1)}%, operating expenses consume {operatingExpensePct.toFixed(1)}% of revenue, and cash movement is split across operating, investing and financing sections from QuickBooks.
            </div>
            <div className="text-center text-xs text-gray-400">
              Last updated: {new Date(data.lastFetchedAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {(data.totalAssets !== undefined || data.netCashChange !== undefined) && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {data.netCashChange !== undefined && (
            <PnlKpiCard title="Net Cash Change" value={data.netCashChange} prevValue={0} format="currency" />
          )}
          {data.totalAssets !== undefined && (
            <PnlKpiCard title="Total Assets" value={data.totalAssets} prevValue={0} format="currency" />
          )}
          {data.totalLiabilities !== undefined && (
            <PnlKpiCard title="Liabilities" value={data.totalLiabilities} prevValue={0} format="currency" />
          )}
          {data.totalEquity !== undefined && (
            <PnlKpiCard title="Equity" value={data.totalEquity} prevValue={0} format="currency" />
          )}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">QuickBooks Expense Categories</CardTitle>
          <p className="text-xs text-gray-500">Detailed category ranking from the QuickBooks expense section for the selected window.</p>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-2 pr-3">Category</th>
                  <th className="pb-2 pr-3 text-right">Amount</th>
                  <th className="pb-2 text-right">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.expensesByCategory.map((category) => (
                  <tr key={category.category} className="border-b last:border-b-0">
                    <td className="py-2 pr-3 font-medium text-gray-900">{category.category}</td>
                    <td className="py-2 pr-3 text-right font-semibold text-gray-900">{formatK(category.amount)}</td>
                    <td className="py-2 text-right text-gray-500">{category.pctOfTotal.toFixed(1)}%</td>
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
