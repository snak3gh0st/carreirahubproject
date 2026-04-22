"use client";

import { CashFlowData, ReceivablesProjectionData } from "@/lib/types/financial-bi";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell,
  PieChart, Pie, ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface CashFlowTabProps {
  data: CashFlowData;
  receivablesProjection?: ReceivablesProjectionData;
}

const probColors = ["#22c55e", "#f59e0b", "#f97316", "#ef4444"];

function fmt(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

const riskBadge: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  HIGH: "bg-orange-100 text-orange-700",
  CRITICAL: "bg-red-100 text-red-700",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{children}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

function DelinquencyPanel({ d }: { d: ReceivablesProjectionData["delinquency"] }) {
  const rate = d.delinquencyRate.toFixed(1);
  const rateColor = d.delinquencyRate > 40 ? "text-red-600" : d.delinquencyRate > 20 ? "text-amber-600" : "text-green-600";

  return (
    <Card className="border-l-4 border-l-red-500">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Inadimplência (Delinquency)</span>
          <span className={`text-xl font-bold ${rateColor}`}>{rate}% do AR</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 mb-4 sm:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3 text-center">
            <div className="text-[10px] uppercase text-gray-500">Total AR</div>
            <div className="text-lg font-bold text-gray-800">{fmt(d.totalAR)}</div>
          </div>
          <div className="rounded-lg bg-red-50 p-3 text-center">
            <div className="text-[10px] uppercase text-red-500">Em Atraso</div>
            <div className="text-lg font-bold text-red-600">{fmt(d.totalDelinquent)}</div>
          </div>
          <div className="rounded-lg bg-green-50 p-3 text-center">
            <div className="text-[10px] uppercase text-green-600">Recuperação Est.</div>
            <div className="text-lg font-bold text-green-700">{fmt(d.estimatedRecovery)}</div>
          </div>
          <div className="rounded-lg bg-orange-50 p-3 text-center">
            <div className="text-[10px] uppercase text-orange-500">Perda Estimada</div>
            <div className="text-lg font-bold text-orange-600">{fmt(d.estimatedLoss)}</div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Aging dos Atrasos</div>
          <div className="flex gap-1.5">
            {[
              { label: "1-30d", value: d.days1to30, color: "bg-amber-400" },
              { label: "31-60d", value: d.days31to60, color: "bg-orange-500" },
              { label: "61-90d", value: d.days61to90, color: "bg-red-500" },
              { label: "90+d", value: d.days90plus, color: "bg-red-800" },
            ].map((b) => {
              const pct = d.totalDelinquent > 0 ? (b.value / d.totalDelinquent) * 100 : 0;
              return (
                <div key={b.label} className="flex-1 text-center">
                  <div className={`${b.color} rounded py-1.5 text-[10px] font-bold text-white`}>{b.label}</div>
                  <div className="mt-1 text-[11px] font-semibold">{fmt(b.value)}</div>
                  <div className="text-[9px] text-gray-400">{pct.toFixed(0)}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MonthlyProjectionTable({
  rows,
  monthlyBreakeven,
}: {
  rows: ReceivablesProjectionData["monthlyProjection"];
  monthlyBreakeven: number;
}) {
  const hasBreakeven = monthlyBreakeven > 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center justify-between">
          <span>Projeção Mensal de Recebíveis (6 meses)</span>
          {hasBreakeven && (
            <span className="text-[11px] font-normal text-gray-500">
              Breakeven mensal:{" "}
              <span className="font-bold text-purple-600">{fmt(monthlyBreakeven)}</span>
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={rows} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="totalDue" name="Total a Receber" fill="#93c5fd" radius={[3, 3, 0, 0]} />
              <Bar dataKey="collectionExpected" name="Coleta Esperada" fill="#22c55e" radius={[3, 3, 0, 0]} />
              <Bar dataKey="conservative" name="Conservador" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              {hasBreakeven && (
                <ReferenceLine
                  y={monthlyBreakeven}
                  stroke="#7c3aed"
                  strokeDasharray="6 3"
                  strokeWidth={2}
                  label={{ value: `Breakeven ${fmt(monthlyBreakeven)}`, fill: "#7c3aed", fontSize: 10, position: "insideTopRight" }}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-[10px] uppercase tracking-wide text-gray-500">
                <th className="px-2 py-2">Mês</th>
                <th className="px-2 py-2 text-right">Fat.</th>
                <th className="px-2 py-2 text-right">Total a Rec.</th>
                <th className="px-2 py-2 text-right">Em Atraso</th>
                <th className="px-2 py-2 text-right">Esperado</th>
                <th className="px-2 py-2 text-right">Conservador</th>
                {hasBreakeven && <th className="px-2 py-2 text-center">vs Breakeven</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const aboveBreakeven = hasBreakeven && row.collectionExpected >= monthlyBreakeven;
                const aboveBreakevenConservative = hasBreakeven && row.conservative >= monthlyBreakeven;
                return (
                  <tr key={row.month} className={`border-b transition hover:bg-gray-50 ${i === 0 ? "bg-blue-50 font-medium" : ""}`}>
                    <td className="px-2 py-2">
                      {row.monthLabel}
                      {i === 0 && <span className="ml-1 rounded bg-blue-200 px-1 text-[9px] text-blue-700">atual</span>}
                    </td>
                    <td className="px-2 py-2 text-right text-gray-400">{row.invoiceCount}</td>
                    <td className="px-2 py-2 text-right font-semibold">{fmt(row.totalDue)}</td>
                    <td className={`px-2 py-2 text-right font-semibold ${row.delinquentAmount > 0 ? "text-red-600" : "text-gray-300"}`}>
                      {row.delinquentAmount > 0 ? fmt(row.delinquentAmount) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right text-green-700">{fmt(row.collectionExpected)}</td>
                    <td className="px-2 py-2 text-right text-amber-600">{fmt(row.conservative)}</td>
                    {hasBreakeven && (
                      <td className="px-2 py-2 text-center">
                        {aboveBreakeven ? (
                          <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">✓ OK</span>
                        ) : aboveBreakevenConservative ? (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">~ Limite</span>
                        ) : (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-700">
                            -{fmt(monthlyBreakeven - row.collectionExpected)}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-gray-100 font-bold text-xs">
                <td className="px-2 py-2">Total 6 meses</td>
                <td className="px-2 py-2 text-right text-gray-400">{rows.reduce((s, r) => s + r.invoiceCount, 0)}</td>
                <td className="px-2 py-2 text-right">{fmt(rows.reduce((s, r) => s + r.totalDue, 0))}</td>
                <td className="px-2 py-2 text-right text-red-600">{fmt(rows.reduce((s, r) => s + r.delinquentAmount, 0))}</td>
                <td className="px-2 py-2 text-right text-green-700">{fmt(rows.reduce((s, r) => s + r.collectionExpected, 0))}</td>
                <td className="px-2 py-2 text-right text-amber-600">{fmt(rows.reduce((s, r) => s + r.conservative, 0))}</td>
                {hasBreakeven && (
                  <td className="px-2 py-2 text-center text-purple-600 text-[10px]">
                    BEP: {fmt(monthlyBreakeven)}/mês
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function CashFlowTab({ data, receivablesProjection }: CashFlowTabProps) {
  return (
    <div className="space-y-6">

      {/* ── Critical signals ─────────────────────────────────── */}
      {receivablesProjection && (
        <div className="space-y-4">
          <SectionLabel>Risco de Recebimento</SectionLabel>
          <DelinquencyPanel d={receivablesProjection.delinquency} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="text-center">
              <CardContent className="pt-4 pb-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Vence em 7 dias</div>
                <div className="mt-1 text-xl font-bold text-amber-600">{fmt(receivablesProjection.upcomingNext7Days)}</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Vence em 30 dias</div>
                <div className="mt-1 text-xl font-bold text-blue-600">{fmt(receivablesProjection.upcomingNext30Days)}</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Total em Atraso</div>
                <div className="mt-1 text-xl font-bold text-red-600">{fmt(receivablesProjection.overdueTotal)}</div>
              </CardContent>
            </Card>
            <Card className="text-center">
              <CardContent className="pt-4 pb-3">
                <div className="text-[10px] uppercase tracking-wide text-gray-400">Total AR</div>
                <div className="mt-1 text-xl font-bold text-gray-700">{fmt(receivablesProjection.delinquency.totalAR)}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ── 6-month projection ───────────────────────────────── */}
      {receivablesProjection && (
        <div className="space-y-3">
          <SectionLabel>Projeção de Recebíveis</SectionLabel>
          <MonthlyProjectionTable
            rows={receivablesProjection.monthlyProjection}
            monthlyBreakeven={receivablesProjection.monthlyBreakeven}
          />
        </div>
      )}

      {/* ── Collection probability ───────────────────────────── */}
      <div className="space-y-3">
        <SectionLabel>Análise de Probabilidade</SectionLabel>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">Probabilidade de Recebimento (AR Atual)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data.probabilityBreakdown.filter((s) => s.amount > 0)}
                    dataKey="amount"
                    nameKey="segment"
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={85}
                  >
                    {data.probabilityBreakdown.map((_, i) => (
                      <Cell key={i} fill={probColors[i] || "#94a3b8"} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm">At-Risk Invoices ({data.atRiskInvoices.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b text-left text-[10px] uppercase tracking-wide text-gray-400">
                      <th className="pb-2 pr-3">Cliente</th>
                      <th className="pb-2 pr-3 text-right">Valor</th>
                      <th className="pb-2 pr-3 text-right">Atraso</th>
                      <th className="pb-2 pr-3 text-right">Prob.</th>
                      <th className="pb-2">Risco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.atRiskInvoices.slice(0, 10).map((inv) => (
                      <tr key={inv.id} className={`border-b transition hover:bg-gray-50 ${inv.riskLevel === "CRITICAL" ? "bg-red-50" : ""}`}>
                        <td className="py-1.5 pr-3 font-medium">{inv.customerName}</td>
                        <td className="py-1.5 pr-3 text-right font-semibold">{fmt(inv.amount)}</td>
                        <td className="py-1.5 pr-3 text-right text-gray-500">{inv.daysOverdue}d</td>
                        <td className="py-1.5 pr-3 text-right">{inv.probability}%</td>
                        <td className="py-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${riskBadge[inv.riskLevel]}`}>{inv.riskLevel}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
