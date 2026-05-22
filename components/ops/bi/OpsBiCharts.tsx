"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { OpsBiDashboard } from "@/lib/ops/ops-bi";

const CHART_COLORS = [
  "var(--brand-verde)",
  "var(--info-500)",
  "var(--success-600)",
  "var(--warning-600)",
  "var(--error-600)",
  "var(--primary-500)",
] as const;

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3 text-xs shadow-lg">
      <p className="mb-2 font-bold text-gray-900">{label}</p>
      <div className="space-y-1">
        {payload.map((entry: any) => (
          <div key={entry.name} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-gray-500">{entry.name}</span>
            <span className="ml-auto font-bold text-gray-900">{entry.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-2 pt-2">
      {payload.map((entry: any) => (
        <div key={entry.value} className="flex min-w-0 items-center gap-1.5 text-xs">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="break-words text-gray-500">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 px-4 py-4 sm:px-5">
        <h2 className="font-display text-base font-bold text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

export function OpsBiCharts({ data }: { data: OpsBiDashboard }) {
  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-2 xl:gap-6">
      <Panel
        title="Produção operacional"
        subtitle="Sessões, mock interviews e recolocações nos últimos 6 meses."
      >
        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend} margin={{ top: 16, right: 8, bottom: 12, left: -12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
              <XAxis dataKey="month" stroke="var(--gray-500)" fontSize={10} tickMargin={8} />
              <YAxis stroke="var(--gray-500)" fontSize={10} allowDecimals={false} width={28} />
              <Tooltip content={<ChartTooltip />} />
              <Legend content={<ChartLegend />} />
              <Line type="monotone" name="Sessões" dataKey="sessions" stroke="var(--brand-verde)" strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" name="Mocks" dataKey="mocks" stroke="var(--primary-500)" strokeWidth={2} isAnimationActive={false} />
              <Line type="monotone" name="Recolocações" dataKey="placements" stroke="var(--success-600)" strokeWidth={2} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Alunos por fase" subtitle="Volume ativo e quantidade em risco por área/fase.">
        <div className="h-80 w-full overflow-x-auto">
          <div className="h-full min-w-[520px] sm:min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.phaseDistribution} layout="vertical" margin={{ top: 8, right: 20, bottom: 8, left: 88 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
              <XAxis type="number" stroke="var(--gray-500)" fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="phase" stroke="var(--gray-500)" fontSize={11} width={88} />
              <Tooltip content={<ChartTooltip />} />
              <Legend content={<ChartLegend />} />
              <Bar name="Ativos" dataKey="active" fill="var(--brand-verde)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
              <Bar name="Risco" dataKey="risk" fill="var(--error-600)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      <Panel title="Entregáveis por tipo" subtitle="Materiais/documentos registrados no Hub.">
        <div className="h-80 w-full overflow-x-auto">
          <div className="h-full min-w-[560px] sm:min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.documentMix} margin={{ top: 20, right: 20, bottom: 44, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
              <XAxis dataKey="name" stroke="var(--gray-500)" fontSize={11} angle={-20} textAnchor="end" interval={0} />
              <YAxis stroke="var(--gray-500)" fontSize={12} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} />
              <Bar name="Quantidade" dataKey="value" fill="var(--info-500)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </Panel>

      <Panel title="Aplicações e entrevistas" subtitle="Distribuição por status operacional.">
        <div className="h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 16, right: 8, bottom: 16, left: 8 }}>
              <Tooltip content={<ChartTooltip />} />
              <Legend content={<ChartLegend />} />
              <Pie data={data.activityStatusMix} dataKey="value" nameKey="name" innerRadius={46} outerRadius={82} paddingAngle={2} isAnimationActive={false}>
                {data.activityStatusMix.map((entry, index) => (
                  <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      <Panel title="Carga por responsável" subtitle="Alunos ativos e sessões recentes por pessoa.">
        <div className="space-y-3">
          {data.workload.slice(0, 10).map((row) => {
            const maxStudents = Math.max(...data.workload.map((item) => item.students), 1);
            const width = Math.max((row.students / maxStudents) * 100, row.students ? 8 : 0);
            return (
              <div key={row.owner}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="min-w-0 break-words text-sm font-semibold text-gray-800">{row.owner}</p>
                  <p className="flex-shrink-0 text-xs text-gray-400">{row.students} alunos · {row.sessions} sessões</p>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-brand-verde" style={{ width: `${width}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Pendências críticas" subtitle="Fila operacional que precisa de decisão ou cobrança interna.">
        <div className="grid gap-3 min-[420px]:grid-cols-2">
          {data.criticalPendencies.map((item) => {
            const toneClass = {
              danger: "border-red-100 bg-red-50 text-red-700",
              warning: "border-amber-100 bg-amber-50 text-amber-700",
              info: "border-blue-100 bg-blue-50 text-blue-700",
            }[item.tone];

            return (
              <div key={item.name} className={`rounded-lg border p-3 ${toneClass}`}>
                <p className="text-2xl font-display font-bold">{item.value}</p>
                <p className="mt-1 text-xs font-semibold">{item.name}</p>
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel title="Entregáveis por responsável" subtitle="Materiais criados, finalizados e publicados ao aluno.">
        <div className="space-y-3">
          {data.deliverablesByOwner.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">Nenhum entregável registrado no período.</div>
          ) : (
            data.deliverablesByOwner.map((row) => {
              const maxTotal = Math.max(...data.deliverablesByOwner.map((item) => item.total), 1);
              const width = Math.max((row.total / maxTotal) * 100, row.total ? 8 : 0);
              return (
                <div key={row.owner}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <p className="min-w-0 break-words text-sm font-semibold text-gray-800">{row.owner}</p>
                    <p className="flex-shrink-0 text-xs text-gray-400">
                      {row.final} finais · {row.public} públicos
                    </p>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Panel>

      <Panel title="Recolocações por indústria" subtitle="Classificação para leitura de sucesso e mercado.">
        <div className="h-72 w-full sm:h-80">
          {data.placementIndustries.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-gray-400">
              Nenhuma recolocação classificada no período.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.placementIndustries} margin={{ top: 20, right: 20, bottom: 44, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-200)" />
                <XAxis dataKey="name" stroke="var(--gray-500)" fontSize={11} angle={-20} textAnchor="end" interval={0} />
                <YAxis stroke="var(--gray-500)" fontSize={12} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Bar name="Recolocações" dataKey="value" fill="var(--success-600)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Panel>

      <Panel title="Risco operacional" subtitle="Alunos que mais precisam de ação agora.">
        <div className="divide-y divide-gray-50">
          {data.riskRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">Nenhum aluno em risco no momento.</div>
          ) : (
            data.riskRows.slice(0, 8).map((row) => (
              <a
                key={row.enrollmentId}
                href={`/ops/students/${row.enrollmentId}`}
                className="flex flex-col gap-2 py-3 hover:bg-gray-50 sm:flex-row sm:items-center sm:gap-3"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-600">
                  {row.riskScore}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{row.studentName}</p>
                  <p className="break-words text-xs text-gray-400">{row.phase} · {row.owner}</p>
                </div>
                <span className="text-xs font-semibold text-gray-400 sm:text-right">
                  {row.daysSinceLastSession === null ? "Sem sessão" : `${row.daysSinceLastSession}d sem sessão`}
                </span>
              </a>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}
