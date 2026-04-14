import { z } from 'zod';
import { UserRole } from '@prisma/client';
import { defineAiTool, requireRole } from '../_base';
import { quickbooksService } from '@/lib/services/quickbooks.service';
import { prisma } from '@/lib/db';
import { truncateJson } from '../../dto';

const REPORT_TYPES = ['profit_and_loss', 'cash_flow', 'balance_sheet', 'ar_aging'] as const;
type ReportType = typeof REPORT_TYPES[number];

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
        report: truncateJson(report),
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
