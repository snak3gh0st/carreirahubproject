import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { FinancialBIResponse } from "@/lib/types/financial-bi";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 5 },
  subtitle: { fontSize: 10, color: "#888", marginBottom: 20 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", marginTop: 20, marginBottom: 10, color: "#e67e22" },
  briefing: { backgroundColor: "#1a1a2e", color: "#ddd", padding: 15, borderRadius: 6, marginBottom: 15, fontSize: 10, lineHeight: 1.6 },
  kpiRow: { flexDirection: "row", gap: 8, marginBottom: 15 },
  kpiCard: { flex: 1, backgroundColor: "#f9f9f9", borderRadius: 6, padding: 10, alignItems: "center" },
  kpiLabel: { fontSize: 8, color: "#888", textTransform: "uppercase" },
  kpiValue: { fontSize: 18, fontWeight: "bold", marginVertical: 3 },
  kpiContext: { fontSize: 8 },
  tableHeader: { flexDirection: "row", backgroundColor: "#e67e22", padding: 6, borderRadius: 3 },
  tableHeaderCell: { flex: 1, fontSize: 8, fontWeight: "bold", color: "#fff" },
  tableRow: { flexDirection: "row", padding: 5, borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  tableCell: { flex: 1, fontSize: 8 },
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, textAlign: "center", fontSize: 8, color: "#aaa" },
});

function formatCurrency(value: number): string {
  return value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${value.toFixed(0)}`;
}

interface PdfReportProps {
  data: FinancialBIResponse;
  dateRange: string;
}

export function PdfReport({ data, dateRange }: PdfReportProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Carreira U.S.A. — Financial Report</Text>
        <Text style={styles.subtitle}>Period: {dateRange} | Generated: {new Date().toLocaleDateString()}</Text>

        <View style={styles.briefing}>
          <Text style={{ fontSize: 9, fontWeight: "bold", color: "#e67e22", marginBottom: 5 }}>CFO BRIEFING</Text>
          <Text style={{ color: "#ddd", lineHeight: 1.6 }}>{data.cfoInsight.briefing}</Text>
        </View>

        <View style={styles.kpiRow}>
          {[
            { label: "Revenue", metric: data.summary.revenue, fmt: "currency" as const },
            { label: "Collection Rate", metric: data.summary.collectionRate, fmt: "percent" as const },
            { label: "Outstanding AR", metric: data.summary.outstandingAR, fmt: "currency" as const },
            { label: "MRR", metric: data.summary.mrr, fmt: "currency" as const },
            { label: "Concentration", metric: data.summary.topClientConcentration, fmt: "percent" as const },
          ].map((kpi) => (
            <View key={kpi.label} style={styles.kpiCard}>
              <Text style={styles.kpiLabel}>{kpi.label}</Text>
              <Text style={styles.kpiValue}>
                {kpi.fmt === "currency" ? formatCurrency(kpi.metric.value) : `${kpi.metric.value.toFixed(1)}%`}
              </Text>
              <Text style={styles.kpiContext}>
                {kpi.metric.changePct >= 0 ? "+" : ""}{kpi.metric.changePct.toFixed(1)}% — {kpi.metric.context}
              </Text>
            </View>
          ))}
        </View>

        {data.cfoInsight.actions.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Recommended Actions</Text>
            {data.cfoInsight.actions.map((action, i) => (
              <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 5, padding: 6, backgroundColor: action.severity === "URGENT" ? "#fff5f5" : action.severity === "WATCH" ? "#fffbf0" : "#f0f7ff", borderRadius: 3 }}>
                <Text style={{ fontSize: 8, fontWeight: "bold", color: action.severity === "URGENT" ? "#e74c3c" : action.severity === "WATCH" ? "#f39c12" : "#3498db" }}>{action.severity}</Text>
                <Text style={{ fontSize: 8, flex: 1 }}>{action.description}</Text>
              </View>
            ))}
          </>
        )}

        {data.arCollections && (
          <>
            <Text style={styles.sectionTitle}>AR Aging Breakdown</Text>
            <View>
              <View style={styles.tableHeader}>
                <Text style={styles.tableHeaderCell}>Bucket</Text>
                <Text style={styles.tableHeaderCell}>Count</Text>
                <Text style={styles.tableHeaderCell}>Amount</Text>
              </View>
              {data.arCollections.agingBreakdown.map((b) => (
                <View key={b.bucket} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{b.bucket}</Text>
                  <Text style={styles.tableCell}>{b.count}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(b.amount)}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {data.arCollections && data.arCollections.overdueInvoices.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Top Overdue Invoices</Text>
            <View>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Customer</Text>
                <Text style={styles.tableHeaderCell}>Amount</Text>
                <Text style={styles.tableHeaderCell}>Days Overdue</Text>
                <Text style={styles.tableHeaderCell}>Reminders</Text>
              </View>
              {data.arCollections.overdueInvoices.slice(0, 10).map((inv) => (
                <View key={inv.id} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{inv.customerName}</Text>
                  <Text style={styles.tableCell}>${inv.amount.toLocaleString()}</Text>
                  <Text style={styles.tableCell}>{inv.daysOverdue}d</Text>
                  <Text style={styles.tableCell}>{inv.remindersSent}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {data.receivablesProjection && (
          <>
            <Text style={styles.sectionTitle}>Inadimplência & Projeção de Recebíveis</Text>
            {/* Delinquency summary row */}
            <View style={{ ...styles.kpiRow, marginBottom: 10 }}>
              {[
                { label: "Total AR", value: formatCurrency(data.receivablesProjection.delinquency.totalAR) },
                { label: "Em Atraso", value: formatCurrency(data.receivablesProjection.delinquency.totalDelinquent) },
                { label: "Taxa Inadimpl.", value: `${data.receivablesProjection.delinquency.delinquencyRate.toFixed(1)}%` },
                { label: "Rec. Estimada", value: formatCurrency(data.receivablesProjection.delinquency.estimatedRecovery) },
                { label: "Perda Estimada", value: formatCurrency(data.receivablesProjection.delinquency.estimatedLoss) },
              ].map((item) => (
                <View key={item.label} style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{item.label}</Text>
                  <Text style={{ fontSize: 13, fontWeight: "bold" }}>{item.value}</Text>
                </View>
              ))}
            </View>

            {/* Breakeven note */}
            {data.receivablesProjection.monthlyBreakeven > 0 && (
              <View style={{ backgroundColor: "#f3e8ff", padding: 6, borderRadius: 4, marginBottom: 8, flexDirection: "row", alignItems: "center" }}>
                <Text style={{ fontSize: 9, color: "#7c3aed", fontWeight: "bold" }}>
                  Breakeven Mensal: {formatCurrency(data.receivablesProjection.monthlyBreakeven)}
                </Text>
                <Text style={{ fontSize: 9, color: "#6b7280", marginLeft: 8 }}>
                  — comparar com coluna "Esperado" para avaliar cobertura de caixa
                </Text>
              </View>
            )}

            {/* Monthly projection table */}
            <Text style={{ fontSize: 10, fontWeight: "bold", marginBottom: 5 }}>Projeção Mensal (6 meses)</Text>
            <View>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderCell, flex: 1.5 }}>Mês</Text>
                <Text style={styles.tableHeaderCell}>Fat.</Text>
                <Text style={styles.tableHeaderCell}>Total a Rec.</Text>
                <Text style={styles.tableHeaderCell}>Em Atraso</Text>
                <Text style={styles.tableHeaderCell}>Esperado</Text>
                <Text style={styles.tableHeaderCell}>Conservador</Text>
                {data.receivablesProjection.monthlyBreakeven > 0 && (
                  <Text style={styles.tableHeaderCell}>vs BEP</Text>
                )}
              </View>
              {data.receivablesProjection.monthlyProjection.map((row) => {
                const bep = data.receivablesProjection!.monthlyBreakeven;
                const gap = row.collectionExpected - bep;
                return (
                  <View key={row.month} style={styles.tableRow}>
                    <Text style={{ ...styles.tableCell, flex: 1.5 }}>{row.monthLabel}</Text>
                    <Text style={styles.tableCell}>{row.invoiceCount}</Text>
                    <Text style={styles.tableCell}>{formatCurrency(row.totalDue)}</Text>
                    <Text style={{ ...styles.tableCell, color: row.delinquentAmount > 0 ? "#dc2626" : "#999" }}>
                      {row.delinquentAmount > 0 ? formatCurrency(row.delinquentAmount) : "—"}
                    </Text>
                    <Text style={{ ...styles.tableCell, color: "#16a34a" }}>{formatCurrency(row.collectionExpected)}</Text>
                    <Text style={{ ...styles.tableCell, color: "#d97706" }}>{formatCurrency(row.conservative)}</Text>
                    {bep > 0 && (
                      <Text style={{ ...styles.tableCell, color: gap >= 0 ? "#16a34a" : "#dc2626", fontWeight: "bold" }}>
                        {gap >= 0 ? `+${formatCurrency(gap)}` : `-${formatCurrency(Math.abs(gap))}`}
                      </Text>
                    )}
                  </View>
                );
              })}
              {/* Totals row */}
              <View style={{ ...styles.tableRow, backgroundColor: "#f3f4f6" }}>
                <Text style={{ ...styles.tableCell, flex: 1.5, fontWeight: "bold" }}>Total</Text>
                <Text style={{ ...styles.tableCell, fontWeight: "bold" }}>
                  {data.receivablesProjection.monthlyProjection.reduce((s, r) => s + r.invoiceCount, 0)}
                </Text>
                <Text style={{ ...styles.tableCell, fontWeight: "bold" }}>
                  {formatCurrency(data.receivablesProjection.monthlyProjection.reduce((s, r) => s + r.totalDue, 0))}
                </Text>
                <Text style={{ ...styles.tableCell, fontWeight: "bold", color: "#dc2626" }}>
                  {formatCurrency(data.receivablesProjection.monthlyProjection.reduce((s, r) => s + r.delinquentAmount, 0))}
                </Text>
                <Text style={{ ...styles.tableCell, fontWeight: "bold", color: "#16a34a" }}>
                  {formatCurrency(data.receivablesProjection.monthlyProjection.reduce((s, r) => s + r.collectionExpected, 0))}
                </Text>
                <Text style={{ ...styles.tableCell, fontWeight: "bold", color: "#d97706" }}>
                  {formatCurrency(data.receivablesProjection.monthlyProjection.reduce((s, r) => s + r.conservative, 0))}
                </Text>
                {data.receivablesProjection.monthlyBreakeven > 0 && (
                  <Text style={{ ...styles.tableCell, fontWeight: "bold", color: "#7c3aed" }}>
                    BEP: {formatCurrency(data.receivablesProjection.monthlyBreakeven)}/mês
                  </Text>
                )}
              </View>
            </View>
          </>
        )}

        {data.pnl && (
          <>
            <Text style={styles.sectionTitle}>Profit & Loss Summary</Text>
            <View style={styles.kpiRow}>
              {[
                { label: "Revenue", value: formatCurrency(data.pnl.totalRevenue) },
                { label: "Expenses", value: formatCurrency(data.pnl.totalExpenses) },
                { label: "Net Income", value: formatCurrency(data.pnl.netIncome) },
                { label: "Margin", value: `${data.pnl.marginPct.toFixed(1)}%` },
                { label: "Burn Rate", value: `${formatCurrency(data.pnl.burnRate)}/mo` },
                { label: "Cash", value: formatCurrency(data.pnl.cashOnHand) },
              ].map((item) => (
                <View key={item.label} style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{item.label}</Text>
                  <Text style={{ fontSize: 14, fontWeight: "bold" }}>{item.value}</Text>
                </View>
              ))}
            </View>

            <Text style={{ fontSize: 10, fontWeight: "bold", marginTop: 10, marginBottom: 5 }}>Top Expense Categories</Text>
            <View>
              <View style={styles.tableHeader}>
                <Text style={{ ...styles.tableHeaderCell, flex: 2 }}>Category</Text>
                <Text style={styles.tableHeaderCell}>Amount</Text>
                <Text style={styles.tableHeaderCell}>% of Total</Text>
              </View>
              {data.pnl.expensesByCategory.slice(0, 8).map((c) => (
                <View key={c.category} style={styles.tableRow}>
                  <Text style={{ ...styles.tableCell, flex: 2 }}>{c.category}</Text>
                  <Text style={styles.tableCell}>{formatCurrency(c.amount)}</Text>
                  <Text style={styles.tableCell}>{c.pctOfTotal.toFixed(1)}%</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <Text style={styles.footer}>Carreira AI Hub — Confidential Financial Report — {new Date().toLocaleDateString()}</Text>
      </Page>
    </Document>
  );
}
