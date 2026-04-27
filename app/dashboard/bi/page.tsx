"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, FunnelChart, Funnel, LabelList,
} from "recharts";
import {
  Users, TrendingUp, Target, Clock, AlertTriangle,
  Award, BookOpen, UserCheck, UserX, RefreshCw,
  Calendar, BarChart3, ChevronDown,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

interface AdminBIData {
  kpis: {
    activeStudents: number;
    inactiveStudents: number;
    avgTenureMonths: number;
    wonDeals: number;
    prevWonDeals: number;
    conversionRate: number;
    prevConversionRate: number;
    avgNegotiationDays: number;
    delinquencyRate: number;
    leadConversionRate: number;
    leadsConverted: number;
    totalLeads: number;
  };
  closers: {
    closers: Array<{
      name: string;
      dealsWon: number;
      totalValue: number;
      totalDeals: number;
      conversionRate: number;
    }>;
    monthlyTrend: Array<{ month: string; count: number; value: number }>;
  };
  programs: {
    byProgram: Array<{ program: string; count: number }>;
    byStatus: Array<{ status: string; count: number }>;
    monthlyTrend: Array<{ month: string; PASS: number; ADVANCED: number }>;
  };
  demographics: {
    ageBuckets: Array<{ range: string; count: number }>;
    countries: Array<{ country: string; count: number }>;
    acquisitionTrend: Array<{ month: string; newCustomers: number }>;
    totalCustomers: number;
  };
  funnel: {
    funnel: Array<{ status: string; count: number; avgScore: number }>;
    sources: Array<{ source: string; count: number }>;
    monthlyLeads: Array<{ month: string; total: number; qualified: number }>;
  };
  seasonality: {
    monthlyData: Array<{ month: string; deals: number; dealsValue: number; revenue: number }>;
    paymentMethods: Array<{ method: string; count: number; amount: number }>;
  };
}

// ── Constants ────────────────────────────────────────────────

const BRAND_COLORS = ["#16a34a", "#f97316", "#3b82f6", "#8b5cf6", "#ec4899", "#eab308", "#14b8a6"];

const DATE_RANGE_OPTIONS = [
  { value: "last30", label: "Last 30 days" },
  { value: "last90", label: "Last 90 days" },
  { value: "thisYear", label: "This year" },
  { value: "allTime", label: "All time" },
];

const TABS = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "closers", label: "Sales Performance", icon: Award },
  { key: "programs", label: "Programs & Students", icon: BookOpen },
  { key: "funnel", label: "Lead Funnel", icon: Target },
] as const;

type TabKey = (typeof TABS)[number]["key"];

// ── Helpers ──────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const fmtPct = (n: number) => `${n.toFixed(1)}%`;

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const delta = ((current - previous) / previous) * 100;
  const up = delta >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-green-600" : "text-red-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

// ── KPI Card ─────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  color = "blue",
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
  color?: "blue" | "green" | "orange" | "red" | "purple";
}) {
  const colorMap = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    orange: "bg-orange-50 text-orange-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <div className={`p-2 rounded-lg ${colorMap[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <div className="flex items-end gap-2">
          <span className="text-2xl font-bold text-gray-900">{value}</span>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ── Overview Tab ─────────────────────────────────────────────

function OverviewTab({ data }: { data: AdminBIData }) {
  return (
    <div className="space-y-6">
      {/* Student Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Active vs Inactive Students</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={[
                  { name: "Active", value: data.kpis.activeStudents },
                  { name: "Inactive / Completed", value: data.kpis.inactiveStudents },
                ]}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                <Cell fill="#16a34a" />
                <Cell fill="#d1d5db" />
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Customer Acquisition (12 months)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.demographics.acquisitionTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="newCustomers" fill="#3b82f6" radius={[3, 3, 0, 0]} name="New Customers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Seasonality */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Sales Seasonality — Deals Won vs Revenue (12 months)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={data.seasonality.monthlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) =>
                name === "Revenue" ? fmt(Number(value)) : value
              }
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} name="Revenue" />
            <Line yAxisId="right" type="monotone" dataKey="deals" stroke="#f97316" strokeWidth={2} dot={false} name="Deals Won" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Payment Methods + Age Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Payment Methods</h3>
          {data.seasonality.paymentMethods.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No payment data</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={data.seasonality.paymentMethods}
                  dataKey="amount"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ method, percent }) =>
                    `${method} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {data.seasonality.paymentMethods.map((_, i) => (
                    <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => fmt(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Age Distribution</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.demographics.ageBuckets.filter((b) => b.range !== "Unknown")}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#8b5cf6" radius={[3, 3, 0, 0]} name="Customers" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Country Table */}
      {data.demographics.countries.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Top Countries</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 text-gray-500 font-medium">Country</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Customers</th>
                  <th className="text-right py-2 px-3 text-gray-500 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {data.demographics.countries.map((c, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 px-3 font-medium text-gray-900">{c.country}</td>
                    <td className="py-2 px-3 text-right text-gray-700">{c.count}</td>
                    <td className="py-2 px-3 text-right text-gray-500">
                      {data.demographics.totalCustomers > 0
                        ? fmtPct((c.count / data.demographics.totalCustomers) * 100)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Closers Tab ───────────────────────────────────────────────

function ClosersTab({ data }: { data: AdminBIData }) {
  const { closers, monthlyTrend } = data.closers;

  return (
    <div className="space-y-6">
      {/* Monthly deals won trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Deals Won & Value — Monthly (12 months)</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value, name) =>
                name === "Value" ? fmt(Number(value)) : value
              }
            />
            <Legend />
            <Bar yAxisId="left" dataKey="value" fill="#16a34a" radius={[3, 3, 0, 0]} name="Value" />
            <Line yAxisId="right" type="monotone" dataKey="count" stroke="#f97316" strokeWidth={2} dot={false} name="Deals" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Closer Leaderboard */}
      {closers.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Award className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No deal data in this period.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Top Closers — Revenue</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={closers.slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip formatter={(v) => fmt(Number(v))} />
                <Bar dataKey="totalValue" fill="#16a34a" radius={[0, 3, 3, 0]} name="Revenue Won" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Closer Leaderboard</h3>
            <div className="space-y-2">
              {closers.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0
                        ? "bg-yellow-400 text-white"
                        : i === 1
                        ? "bg-gray-300 text-white"
                        : i === 2
                        ? "bg-orange-400 text-white"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-500">
                      {c.dealsWon} won / {c.totalDeals} total — {c.conversionRate}% rate
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-green-700 whitespace-nowrap">
                    {fmt(c.totalValue)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Programs Tab ─────────────────────────────────────────────

function ProgramsTab({ data }: { data: AdminBIData }) {
  const { byProgram, byStatus, monthlyTrend } = data.programs;

  const statusColors: Record<string, string> = {
    ACTIVE: "#16a34a",
    COMPLETED: "#3b82f6",
    PAUSED: "#f97316",
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Program split */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Enrollments by Program</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={byProgram}
                dataKey="count"
                nameKey="program"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                label={({ program, count }) => `${program}: ${count}`}
              >
                {byProgram.map((_, i) => (
                  <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-2">
            {byProgram.map((p, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ background: BRAND_COLORS[i % BRAND_COLORS.length] }}
                />
                <span className="text-gray-600">{p.program}</span>
                <span className="font-semibold text-gray-900">{p.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Status split */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Enrollment Status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={byStatus}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ status, count }) => `${status}: ${count}`}
              >
                {byStatus.map((s) => (
                  <Cell key={s.status} fill={statusColors[s.status] ?? "#94a3b8"} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Monthly enrollment trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">New Enrollments per Month (12 months)</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={monthlyTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="PASS" stackId="a" fill="#16a34a" radius={[0, 0, 0, 0]} name="PASS" />
            <Bar dataKey="ADVANCED" stackId="a" fill="#f97316" radius={[3, 3, 0, 0]} name="ADVANCED" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ── Lead Funnel Tab ───────────────────────────────────────────

function LeadFunnelTab({ data }: { data: AdminBIData }) {
  const { funnel, sources, monthlyLeads } = data.funnel;

  const funnelColors: Record<string, string> = {
    NEW: "#93c5fd",
    QUALIFYING: "#60a5fa",
    QUALIFIED: "#3b82f6",
    UNQUALIFIED: "#f97316",
    CONVERTED: "#16a34a",
    LOST: "#ef4444",
  };

  const total = funnel.find((f) => f.status === "NEW")?.count || 1;

  return (
    <div className="space-y-6">
      {/* Funnel visualization */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Lead Status Funnel</h3>
        <div className="space-y-2">
          {funnel.map((stage) => (
            <div key={stage.status} className="flex items-center gap-3">
              <span className="w-24 text-xs font-medium text-gray-600 text-right">{stage.status}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max((stage.count / total) * 100, 2)}%`,
                    background: funnelColors[stage.status] ?? "#94a3b8",
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-800">
                  {stage.count}
                  {stage.avgScore > 0 && ` — avg score ${stage.avgScore}`}
                </span>
              </div>
              <span className="w-12 text-xs text-gray-500 text-right">
                {fmtPct((stage.count / total) * 100)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly leads + sources */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">New Leads & Qualified (12 months)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={monthlyLeads}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="total" fill="#93c5fd" radius={[3, 3, 0, 0]} name="All Leads" />
              <Bar dataKey="qualified" fill="#16a34a" radius={[3, 3, 0, 0]} name="Qualified" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Leads by Source</h3>
          {sources.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={sources}
                  dataKey="count"
                  nameKey="source"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ source, count }) => `${source}: ${count}`}
                >
                  {sources.map((_, i) => (
                    <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function AdminBIPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [dateRange, setDateRange] = useState("last90");

  const { data, isLoading, isError, refetch, isFetching } = useQuery<AdminBIData>({
    queryKey: ["admin-bi", dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/analytics/admin-bi?dateRange=${dateRange}`);
      if (!res.ok) throw new Error("Failed to fetch BI data");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const kpis = data?.kpis;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Business Intelligence</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Commercial, operational and student metrics
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {DATE_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Error */}
        {isError && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-800">Failed to load BI data</p>
              <p className="text-sm text-red-600 mt-0.5">
                Check your connection and try refreshing.
              </p>
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <KpiCard
            title="Active Students"
            value={isLoading ? "—" : kpis?.activeStudents ?? 0}
            subtitle={`${kpis?.inactiveStudents ?? 0} inactive/completed`}
            icon={UserCheck}
            color="green"
          />
          <KpiCard
            title="Avg Tenure"
            value={isLoading ? "—" : `${kpis?.avgTenureMonths ?? 0}mo`}
            subtitle="Average months enrolled"
            icon={Clock}
            color="blue"
          />
          <KpiCard
            title="Deals Won"
            value={isLoading ? "—" : kpis?.wonDeals ?? 0}
            subtitle="In selected period"
            icon={Award}
            badge={
              kpis ? (
                <DeltaBadge current={kpis.wonDeals} previous={kpis.prevWonDeals} />
              ) : undefined
            }
            color="green"
          />
          <KpiCard
            title="Conversion Rate"
            value={isLoading ? "—" : fmtPct(kpis?.conversionRate ?? 0)}
            subtitle="Deals WON / total"
            icon={Target}
            badge={
              kpis ? (
                <DeltaBadge current={kpis.conversionRate} previous={kpis.prevConversionRate} />
              ) : undefined
            }
            color="purple"
          />
          <KpiCard
            title="Avg Negotiation"
            value={isLoading ? "—" : `${kpis?.avgNegotiationDays ?? 0}d`}
            subtitle="Lead → deal closed"
            icon={Calendar}
            color="orange"
          />
          <KpiCard
            title="Delinquency Rate"
            value={isLoading ? "—" : fmtPct(kpis?.delinquencyRate ?? 0)}
            subtitle="Overdue / total AR"
            icon={AlertTriangle}
            color={
              (kpis?.delinquencyRate ?? 0) > 20
                ? "red"
                : (kpis?.delinquencyRate ?? 0) > 10
                ? "orange"
                : "green"
            }
          />
        </div>

        {/* Secondary KPI row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Customers</p>
              <p className="text-xl font-bold text-gray-900">
                {isLoading ? "—" : data?.demographics.totalCustomers ?? 0}
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="p-3 bg-green-50 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Lead Conversion</p>
              <p className="text-xl font-bold text-gray-900">
                {isLoading ? "—" : fmtPct(kpis?.leadConversionRate ?? 0)}
              </p>
              <p className="text-xs text-gray-400">
                {kpis?.leadsConverted ?? 0} of {kpis?.totalLeads ?? 0} leads
              </p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
            <div className="p-3 bg-purple-50 rounded-lg">
              <BookOpen className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Programs Running</p>
              <div className="flex gap-3 mt-1">
                {(data?.programs.byProgram ?? []).map((p) => (
                  <div key={p.program} className="text-center">
                    <p className="text-lg font-bold text-gray-900">{p.count}</p>
                    <p className="text-xs text-gray-500">{p.program}</p>
                  </div>
                ))}
                {isLoading && <p className="text-lg font-bold text-gray-400">—</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 mb-6 w-fit">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? "bg-gray-900 text-white"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-gray-400 animate-spin" />
              <p className="text-gray-500 text-sm">Loading BI data…</p>
            </div>
          </div>
        ) : data ? (
          <>
            {activeTab === "overview" && <OverviewTab data={data} />}
            {activeTab === "closers" && <ClosersTab data={data} />}
            {activeTab === "programs" && <ProgramsTab data={data} />}
            {activeTab === "funnel" && <LeadFunnelTab data={data} />}
          </>
        ) : null}
      </div>
    </div>
  );
}
