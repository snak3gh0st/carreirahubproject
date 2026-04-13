"use client";

import { AreaChart, Area, BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface MiniChartRowProps {
  revenueTrend: Array<{ month: string; amount: number }>;
  agingSnapshot: Array<{ bucket: string; amount: number; count: number }>;
}

const agingColors: Record<string, string> = {
  Current: "#22c55e", "1-30": "#f59e0b", "31-60": "#f97316", "61-90": "#ef4444", "90+": "#991b1b",
};

function formatK(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(0)}k` : `$${value.toFixed(0)}`;
}

export function MiniChartRow({ revenueTrend, agingSnapshot }: MiniChartRowProps) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="rounded-lg bg-gray-50 p-3">
        <div className="mb-2 text-xs font-semibold text-gray-700">Revenue Trend (12 months)</div>
        <ResponsiveContainer width="100%" height={70}>
          <AreaChart data={revenueTrend}>
            <defs>
              <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="amount" stroke="#22c55e" fill="url(#revenueGrad)" strokeWidth={2} />
            <Tooltip formatter={(v: number) => formatK(v)} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="rounded-lg bg-gray-50 p-3">
        <div className="mb-2 text-xs font-semibold text-gray-700">AR Aging Snapshot</div>
        <ResponsiveContainer width="100%" height={70}>
          <BarChart data={agingSnapshot}>
            <XAxis dataKey="bucket" tick={{ fontSize: 9 }} />
            <Bar dataKey="amount" radius={[2, 2, 0, 0]}>
              {agingSnapshot.map((entry, i) => (
                <Cell key={i} fill={agingColors[entry.bucket] || "#94a3b8"} />
              ))}
            </Bar>
            <Tooltip formatter={(v: number) => formatK(v)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
