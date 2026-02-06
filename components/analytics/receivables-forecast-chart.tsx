"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from "recharts";
import { format, startOfMonth, eachMonthOfInterval, addMonths } from "date-fns";

interface InvoiceForecast {
  invoiceId: string;
  amount: number;
  predictedPaymentDate: Date;
  collectionProbability: number;
}

interface ReceivablesForecastChartProps {
  forecasts: InvoiceForecast[];
  isLoading?: boolean;
}

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

export function ReceivablesForecastChart({
  forecasts,
  isLoading,
}: ReceivablesForecastChartProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[400px] bg-gray-50 rounded-lg animate-pulse">
        <div className="text-gray-400">Loading forecast chart...</div>
      </div>
    );
  }

  if (!forecasts || forecasts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[400px] bg-gray-50 rounded-lg">
        <div className="text-gray-400 mb-2">No forecast data available</div>
        <div className="text-sm text-gray-500">
          Open invoices are needed to generate a timeline
        </div>
      </div>
    );
  }

  // Generate timeline data - group forecasts by month
  const now = new Date();
  const maxDate = new Date(Math.max(...forecasts.map(f => new Date(f.predictedPaymentDate).getTime())));
  const endDate = addMonths(maxDate, 1);

  const months = eachMonthOfInterval({
    start: startOfMonth(now),
    end: startOfMonth(endDate),
  });

  // Build monthly aggregations
  const monthlyData = months.map((month) => {
    const monthKey = format(month, "yyyy-MM");
    const nextMonth = addMonths(month, 1);

    // Filter invoices predicted for this month
    const invoicesInMonth = forecasts.filter((forecast) => {
      const paymentDate = new Date(forecast.predictedPaymentDate);
      return paymentDate >= month && paymentDate < nextMonth;
    });

    const expectedAmount = invoicesInMonth.reduce((sum, inv) => sum + inv.amount, 0);
    const weightedAmount = invoicesInMonth.reduce(
      (sum, inv) => sum + (inv.amount * inv.collectionProbability / 100),
      0
    );
    const invoiceCount = invoicesInMonth.length;

    return {
      month: format(month, "MMM yyyy"),
      monthKey,
      expected: expectedAmount,
      weighted: weightedAmount,
      count: invoiceCount,
    };
  });

  // Calculate cumulative values
  let cumulativeExpected = 0;
  let cumulativeWeighted = 0;

  const chartData = monthlyData.map((item) => {
    cumulativeExpected += item.expected;
    cumulativeWeighted += item.weighted;

    return {
      ...item,
      cumulativeExpected,
      cumulativeWeighted,
    };
  });

  return (
    <div className="space-y-4">
      {/* Cumulative Collections Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Cumulative Expected Collections
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="month"
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
            />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="line"
            />
            <Area
              type="monotone"
              dataKey="cumulativeWeighted"
              fill="#10b981"
              fillOpacity={0.2}
              stroke="none"
              name="Risk-Adjusted (Cumulative)"
            />
            <Line
              type="monotone"
              dataKey="cumulativeExpected"
              stroke="#3b82f6"
              strokeWidth={3}
              dot={{ r: 4 }}
              name="Expected (Cumulative)"
            />
            <Line
              type="monotone"
              dataKey="cumulativeWeighted"
              stroke="#10b981"
              strokeWidth={3}
              dot={{ r: 4 }}
              strokeDasharray="5 5"
              name="Risk-Adjusted (Cumulative)"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Collections Chart */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">
          Monthly Expected Collections
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="month"
              stroke="#666"
              tick={{ fill: "#666", fontSize: 12 }}
            />
            <YAxis
              stroke="#666"
              tick={{ fill: "#666", fontSize: 12 }}
              tickFormatter={(value) => formatCurrency(value)}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                if (name === "count") {
                  return [value, "Invoices"];
                }
                return [formatCurrency(value), name];
              }}
              contentStyle={{
                backgroundColor: "white",
                border: "1px solid #e0e0e0",
                borderRadius: "8px",
                padding: "12px",
              }}
            />
            <Legend
              wrapperStyle={{ paddingTop: "20px" }}
              iconType="rect"
            />
            <Area
              type="monotone"
              dataKey="weighted"
              fill="#10b981"
              fillOpacity={0.3}
              stroke="#10b981"
              strokeWidth={2}
              name="Risk-Adjusted"
            />
            <Line
              type="monotone"
              dataKey="expected"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ r: 4 }}
              name="Expected"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Summary Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {chartData.slice(0, 6).map((item) => (
          <div
            key={item.monthKey}
            className="bg-gray-50 rounded-lg p-3 border border-gray-200"
          >
            <div className="text-xs text-gray-600 mb-1">{item.month}</div>
            <div className="text-sm font-semibold text-gray-900 mb-1">
              {formatCurrency(item.weighted)}
            </div>
            <div className="text-xs text-gray-500">
              {item.count} invoice{item.count !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
