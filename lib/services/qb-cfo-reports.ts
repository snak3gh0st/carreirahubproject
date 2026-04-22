import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import {
  parseBalanceSheet,
  parseProfitAndLoss,
  parseCashFlow,
  parseAgingSummary,
  parseEntitySummaryReport,
} from "@/lib/services/qb-report-parser";
import { buildQbCfoReportPacket, QbCfoReportPacket } from "@/lib/financial/qb-cfo-report-packet";
import { format } from "date-fns";

const QB_CFO_REPORT_TYPES = [
  "ProfitAndLoss",
  "BalanceSheet",
  "CashFlow",
  "AgedReceivables",
  "AgedPayables",
  "CustomerSales",
  "VendorExpenses",
] as const;

export type QbCfoReportType = (typeof QB_CFO_REPORT_TYPES)[number];

function buildReportWindow() {
  const now = new Date();
  return {
    now,
    startDate: new Date("2025-01-01"),
  };
}

export async function refreshQbCfoReports(): Promise<void> {
  const { now, startDate } = buildReportWindow();
  const start = format(startDate, "yyyy-MM-dd");
  const today = format(now, "yyyy-MM-dd");

  const reportResults = await Promise.all([
    quickbooksService.getProfitAndLossReport(start, today).then((raw) => ({
      reportType: "ProfitAndLoss" as const,
      data: parseProfitAndLoss(raw),
      parameters: { startDate: start, endDate: today },
    })),
    quickbooksService.getBalanceSheetReport(today).then((raw) => ({
      reportType: "BalanceSheet" as const,
      data: parseBalanceSheet(raw),
      parameters: { asOfDate: today },
    })),
    quickbooksService.getCashFlowReport(start, today).then((raw) => ({
      reportType: "CashFlow" as const,
      data: parseCashFlow(raw),
      parameters: { startDate: start, endDate: today },
    })),
    quickbooksService.getAgedReceivablesReport(today).then((raw) => ({
      reportType: "AgedReceivables" as const,
      data: parseAgingSummary(raw),
      parameters: { asOfDate: today },
    })),
    quickbooksService.getAgedPayablesReport(today).then((raw) => ({
      reportType: "AgedPayables" as const,
      data: parseAgingSummary(raw),
      parameters: { asOfDate: today },
    })),
    quickbooksService.getCustomerSalesReport(start, today).then((raw) => ({
      reportType: "CustomerSales" as const,
      data: parseEntitySummaryReport(raw),
      parameters: { startDate: start, endDate: today },
    })),
    quickbooksService.getVendorExpensesReport(start, today).then((raw) => ({
      reportType: "VendorExpenses" as const,
      data: parseEntitySummaryReport(raw),
      parameters: { startDate: start, endDate: today },
    })),
  ]);

  await Promise.all(
    reportResults.map((report) =>
      prisma.qbReportCache.upsert({
        where: { reportType: report.reportType },
        update: {
          data: JSON.stringify(report.data),
          parameters: JSON.stringify(report.parameters),
          fetchedAt: now,
        },
        create: {
          reportType: report.reportType,
          data: JSON.stringify(report.data),
          parameters: JSON.stringify(report.parameters),
          fetchedAt: now,
        },
      })
    )
  );
}

export async function getCachedQbCfoReportPacket(): Promise<QbCfoReportPacket> {
  const reports = await prisma.qbReportCache.findMany({
    where: { reportType: { in: [...QB_CFO_REPORT_TYPES] } },
  });

  const map = Object.fromEntries(
    reports.map((report) => [report.reportType, JSON.parse(report.data)])
  );

  return buildQbCfoReportPacket(map);
}
