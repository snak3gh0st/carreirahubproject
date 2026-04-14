import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { quickbooksService } from '@/lib/services/quickbooks.service';
import { prisma } from '@/lib/db';
import { truncateJson } from '../../dto';

const REPORT_TYPES = ['profit_and_loss', 'cash_flow', 'balance_sheet', 'ar_aging'] as const;
type ReportType = typeof REPORT_TYPES[number];

type QbRow = {
  type?: string;
  group?: string;
  ColData?: Array<{ value?: string }>;
  Summary?: { ColData?: Array<{ value?: string }> };
  Rows?: { Row?: QbRow[] };
};

function parseAmount(v?: string): number {
  if (!v) return 0;
  const n = Number(String(v).replace(/[,\s]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function flattenExpenseRows(rows: QbRow[] | undefined): Array<{ name: string; amount: number }> {
  if (!rows) return [];
  const out: Array<{ name: string; amount: number }> = [];
  for (const r of rows) {
    if (r.type === 'Data' && r.ColData && r.ColData.length >= 2) {
      const name = r.ColData[0]?.value ?? '(sem nome)';
      const amount = parseAmount(r.ColData[r.ColData.length - 1]?.value);
      if (amount !== 0) out.push({ name, amount });
    }
    if (r.Rows?.Row) out.push(...flattenExpenseRows(r.Rows.Row));
  }
  return out;
}

function summarizeQbReport(report: unknown, reportType: ReportType): unknown {
  if (reportType !== 'profit_and_loss') {
    // For other report types, fall back to more aggressive truncation (~3KB)
    return truncateJson(report, 3_000);
  }
  try {
    const r = report as { Header?: { StartPeriod?: string; EndPeriod?: string; Currency?: string }; Rows?: { Row?: QbRow[] } };
    const topRows = r?.Rows?.Row ?? [];
    let incomeTotal = 0;
    let expensesTotal = 0;
    let netIncome = 0;
    let topExpenses: Array<{ name: string; amount: number }> = [];

    for (const section of topRows) {
      if (section.type !== 'Section') continue;
      const summaryAmount = parseAmount(section.Summary?.ColData?.[section.Summary.ColData.length - 1]?.value);
      const group = (section.group ?? '').toLowerCase();
      const headerLabel = section.Summary?.ColData?.[0]?.value?.toLowerCase() ?? '';
      if (group === 'income' || headerLabel.includes('total income') || headerLabel.includes('total revenue')) {
        incomeTotal = summaryAmount;
      } else if (group === 'expenses' || headerLabel.includes('total expenses')) {
        expensesTotal = summaryAmount;
        topExpenses = flattenExpenseRows(section.Rows?.Row)
          .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
          .slice(0, 10);
      } else if (group === 'netincome' || headerLabel.includes('net income')) {
        netIncome = summaryAmount;
      }
    }
    if (netIncome === 0 && (incomeTotal || expensesTotal)) {
      netIncome = incomeTotal - expensesTotal;
    }
    return {
      period: {
        start: r?.Header?.StartPeriod ?? null,
        end: r?.Header?.EndPeriod ?? null,
      },
      currency: r?.Header?.Currency ?? 'USD',
      income_total: incomeTotal,
      expenses_total: expensesTotal,
      net_income: netIncome,
      top_expenses: topExpenses,
    };
  } catch (err) {
    // If parsing fails, fall back to conservative truncation
    return { __parse_error: (err as Error).message, fallback: truncateJson(report, 3_000) };
  }
}

function todayISO(): string { return new Date().toISOString().slice(0, 10); }
function monthStartISO(): string {
  const d = new Date(); d.setDate(1);
  return d.toISOString().slice(0, 10);
}

async function dispatchReport(reportType: ReportType, startDate?: string, endDate?: string): Promise<unknown> {
  const start = startDate ?? monthStartISO();
  const end = endDate ?? todayISO();
  switch (reportType) {
    case 'profit_and_loss': return quickbooksService.getProfitAndLossReport(start, end);
    case 'cash_flow':       return quickbooksService.getCashFlowReport(start, end);
    case 'balance_sheet':   return quickbooksService.getBalanceSheetReport(endDate ?? todayISO());
    case 'ar_aging':        return quickbooksService.getAgedReceivablesReport(endDate ?? todayISO());
  }
}

export const getQuickBooksReport = defineAiTool({
  name: 'getQuickBooksReport',
  description: 'Consulta relatórios financeiros ao vivo no QuickBooks (P&L, fluxo de caixa, balanço, aging de recebíveis). Use quando o usuário perguntar sobre resultado do mês, fluxo de caixa, ou inadimplência consolidada.',
  allowedRoles: [UserRole.ADMIN, UserRole.FINANCE],
  inputSchema: z.object({
    reportType: z.enum(REPORT_TYPES).default('profit_and_loss'),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
  async handler({ reportType = 'profit_and_loss', startDate, endDate }, ctx) {
    requireRole(ctx.user.role, [UserRole.ADMIN, UserRole.FINANCE]);
    const started = Date.now();
    try {
      const report = await Promise.race([
        dispatchReport(reportType, startDate, endDate),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('QB timeout 20s')), 20_000)
        ),
      ]);
      await prisma.integrationLog.create({
        data: {
          service: 'quickbooks',
          action: `ai.report.${reportType}`,
          status: 'SUCCESS',
          payload: { startDate, endDate, report: truncateJson(report) } as never,
        },
      }).catch(() => {}); // logging best-effort
      return {
        reportType,
        startDate,
        endDate,
        summary: summarizeQbReport(report, reportType),
        fetchedAt: new Date().toISOString(),
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      const message = (err as Error).message;
      await prisma.integrationLog.create({
        data: {
          service: 'quickbooks',
          action: `ai.report.${reportType}`,
          status: 'ERROR',
          error: message,
        },
      }).catch(() => {});
      return { error: `Falha ao consultar QuickBooks: ${message}` };
    }
  },
});
