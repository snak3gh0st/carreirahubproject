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
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader><CardTitle className="text-sm">Invoiced vs Collected</CardTitle></CardHeader>
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
        <CardHeader><CardTitle className="text-sm">Revenue by Service</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data.revenueByService} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="service" tick={{ fontSize: 11 }} width={120} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Bar dataKey="amount" fill="var(--brand-tangerina)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="text-sm">MRR / ARR Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data.mrrTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatK} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatK(v)} />
              <Legend />
              <Line type="monotone" dataKey="mrr" name="MRR" stroke="#8b5cf6" strokeWidth={2} dot={false} />
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
  );
}
