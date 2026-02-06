"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface CashFlowProjectionData {
  period: string;
  periodLabel: string;
  expectedAmount: number;
  pessimisticAmount: number;
  optimisticAmount: number;
  invoiceCount: number;
  avgCollectionProbability: number;
}

interface CashFlowProjectionChartProps {
  data: CashFlowProjectionData[];
  isLoading?: boolean;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function CashFlowProjectionChart({
  data,
  isLoading,
}: CashFlowProjectionChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg animate-pulse">
        <div className="text-gray-400">Carregando previsão...</div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-gray-50 rounded-lg">
        <div className="text-gray-400 mb-2">Nenhum dado de previsão disponível</div>
        <div className="text-sm text-gray-500">
          Faturas em aberto são necessárias para gerar projeções
        </div>
      </div>
    );
  }

  // Prepare chart data
  const chartData = data.map((item) => ({
    period: item.periodLabel,
    Esperado: item.expectedAmount,
    "Ponderado (Probabilidade)": item.pessimisticAmount,
    invoices: item.invoiceCount,
    probability: item.avgCollectionProbability,
  }));

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={400}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            dataKey="period"
            stroke="#666"
            tick={{ fill: "#666", fontSize: 12 }}
          />
          <YAxis
            stroke="#666"
            tick={{ fill: "#666", fontSize: 12 }}
            tickFormatter={(value) => formatCurrency(value)}
          />
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #e0e0e0",
              borderRadius: "8px",
              padding: "12px",
            }}
            labelStyle={{ fontWeight: "bold", marginBottom: "8px" }}
          />
          <Legend
            wrapperStyle={{ paddingTop: "20px" }}
            iconType="rect"
            iconSize={12}
          />
          <Bar
            dataKey="Esperado"
            fill="#3b82f6"
            radius={[8, 8, 0, 0]}
            name="Recebimentos Esperados"
          />
          <Bar
            dataKey="Ponderado (Probabilidade)"
            fill="#10b981"
            radius={[8, 8, 0, 0]}
            name="Recebimentos Ajustados ao Risco"
          />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.map((period) => (
          <div
            key={period.period}
            className="bg-gray-50 rounded-lg p-4 border border-gray-200"
          >
            <div className="text-xs text-gray-600 mb-1">{period.periodLabel}</div>
            <div className="text-lg font-semibold text-gray-900 mb-1">
              {formatCurrency(period.pessimisticAmount)}
            </div>
            <div className="text-xs text-gray-500">
              {period.invoiceCount} faturas · {period.avgCollectionProbability}% prob
            </div>
            <div className="mt-2 flex items-center gap-1">
              <div
                className="h-1.5 bg-green-500 rounded-full"
                style={{
                  width: `${period.avgCollectionProbability}%`,
                }}
              />
              <div
                className="h-1.5 bg-gray-200 rounded-full flex-1"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
