import { format } from "date-fns";

import { buildQbCfoReportPacket } from "@/lib/financial/qb-cfo-report-packet";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import {
  parseAgingSummary,
  ensureParsedBalanceSheet,
  ensureParsedCashFlow,
  ensureParsedProfitAndLoss,
  parseEntitySummaryReport,
  type ParsedBalanceSheet,
  type ParsedCashFlow,
  type ParsedEntitySummary,
  type ParsedPnL,
} from "@/lib/services/qb-report-parser";

export interface QuickBooksWindowedFinancials {
  currentPnl: ParsedPnL;
  previousPnl: ParsedPnL;
  currentBalanceSheet: ParsedBalanceSheet;
  currentCashFlow: ParsedCashFlow;
  currentArAging: NonNullable<ReturnType<typeof buildQbCfoReportPacket>["arAging"]>;
  previousArAging: NonNullable<ReturnType<typeof buildQbCfoReportPacket>["arAging"]>;
  currentCustomerSales: ParsedEntitySummary;
  previousCustomerSales: ParsedEntitySummary;
}

const WINDOW_CACHE_TTL_MS = 5 * 60 * 1000;

type WindowCacheEntry = {
  expiresAt: number;
  promise: Promise<QuickBooksWindowedFinancials>;
};

const windowCache = new Map<string, WindowCacheEntry>();

function getWindowCacheKey(startDate: Date, endDate: Date, prevStart: Date, prevEnd: Date): string {
  return [toQbDate(startDate), toQbDate(endDate), toQbDate(prevStart), toQbDate(prevEnd)].join("|");
}

function toQbDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export async function loadQuickBooksWindowedFinancials(
  startDate: Date,
  endDate: Date,
  prevStart: Date,
  prevEnd: Date,
): Promise<QuickBooksWindowedFinancials> {
  const cacheKey = getWindowCacheKey(startDate, endDate, prevStart, prevEnd);
  const now = Date.now();
  const cached = windowCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const currentStart = toQbDate(startDate);
  const currentEnd = toQbDate(endDate);
  const previousStart = toQbDate(prevStart);
  const previousEnd = toQbDate(prevEnd);

  const promise = (async () => {
    const [
      currentPnlRaw,
      previousPnlRaw,
      balanceSheetRaw,
      cashFlowRaw,
      currentArRaw,
      previousArRaw,
      customerSalesRaw,
      previousCustomerSalesRaw,
    ] = await Promise.all([
      quickbooksService.getProfitAndLossReport(currentStart, currentEnd),
      quickbooksService.getProfitAndLossReport(previousStart, previousEnd),
      quickbooksService.getBalanceSheetReport(currentEnd),
      quickbooksService.getCashFlowReport(currentStart, currentEnd),
      quickbooksService.getAgedReceivablesReport(currentEnd),
      quickbooksService.getAgedReceivablesReport(previousEnd),
      quickbooksService.getCustomerSalesReport(currentStart, currentEnd),
      quickbooksService.getCustomerSalesReport(previousStart, previousEnd),
    ]);

    const currentPnl = ensureParsedProfitAndLoss(currentPnlRaw);
    const previousPnl = ensureParsedProfitAndLoss(previousPnlRaw);
    const currentBalanceSheet = ensureParsedBalanceSheet(balanceSheetRaw);
    const currentCashFlow = ensureParsedCashFlow(cashFlowRaw);
    const currentCustomerSales = parseEntitySummaryReport(customerSalesRaw);
    const previousCustomerSales = parseEntitySummaryReport(previousCustomerSalesRaw);

    const currentArAgingPacket = buildQbCfoReportPacket({
      AgedReceivables: parseAgingSummary(currentArRaw),
    }).arAging;
    const previousArAgingPacket = buildQbCfoReportPacket({
      AgedReceivables: parseAgingSummary(previousArRaw),
    }).arAging;

    return {
      currentPnl,
      previousPnl,
      currentBalanceSheet,
      currentCashFlow,
      currentArAging: currentArAgingPacket ?? { totalOpenReceivables: 0, buckets: {}, topCustomers: [] },
      previousArAging: previousArAgingPacket ?? { totalOpenReceivables: 0, buckets: {}, topCustomers: [] },
      currentCustomerSales,
      previousCustomerSales,
    };
  })().catch((error) => {
    windowCache.delete(cacheKey);
    throw error;
  });

  windowCache.set(cacheKey, {
    expiresAt: now + WINDOW_CACHE_TTL_MS,
    promise,
  });

  return promise;
}
