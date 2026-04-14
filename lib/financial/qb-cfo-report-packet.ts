type ReportMap = Record<string, any>;

export interface QbCfoReportPacket {
  profitAndLoss?: {
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    topExpenseCategories: Array<{ name: string; amount: number }>;
  };
  balanceSheet?: {
    cash: number;
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  cashFlow?: {
    netCashChange: number;
    operating: number;
    investing: number;
    financing: number;
  };
  arAging?: {
    totalOpenReceivables: number;
    buckets: Record<string, number>;
    topCustomers: Array<{ name: string; total: number }>;
  };
  apAging?: {
    totalOpenPayables: number;
    buckets: Record<string, number>;
    topVendors: Array<{ name: string; total: number }>;
  };
  salesByCustomer?: {
    topCustomers: Array<{ name: string; total: number }>;
  };
  vendorExpenses?: {
    topVendors: Array<{ name: string; total: number }>;
  };
}

function asNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    return Number(value.replace(/,/g, "")) || 0;
  }
  return 0;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function buildAgingBuckets(columns: string[], rows: Array<{ name: string; values?: number[]; total?: number }>) {
  const bucketNames = columns.filter((column) => column !== "Total");
  const bucketTotals: Record<string, number> = {};

  for (const bucket of bucketNames) {
    bucketTotals[bucket] = 0;
  }

  const topEntities = rows
    .map((row) => {
      const values = row.values || [];
      bucketNames.forEach((bucket, index) => {
        bucketTotals[bucket] = (bucketTotals[bucket] || 0) + asNumber(values[index]);
      });
      const total = row.total ?? values.reduce((sum, value) => sum + asNumber(value), 0);
      return { name: row.name, total };
    })
    .sort((a, b) => b.total - a.total);

  const totalOpen = Object.values(bucketTotals).reduce((sum, value) => sum + value, 0);

  return { bucketTotals, topEntities, totalOpen };
}

function getSectionTotal(sections: Array<{ name: string; total: number }> | undefined, names: string[]): number {
  if (!sections) return 0;
  const wanted = names.map(normalizeName);
  const match = sections.find((section) => wanted.includes(normalizeName(section.name)));
  return match ? asNumber(match.total) : 0;
}

export function buildQbCfoReportPacket(reports: ReportMap): QbCfoReportPacket {
  const packet: QbCfoReportPacket = {};

  if (reports.ProfitAndLoss) {
    packet.profitAndLoss = {
      totalIncome: asNumber(reports.ProfitAndLoss.income?.total),
      totalExpenses: asNumber(reports.ProfitAndLoss.expenses?.total) + asNumber(reports.ProfitAndLoss.cogs?.total),
      netIncome: asNumber(reports.ProfitAndLoss.netIncome?.total),
      topExpenseCategories: (reports.ProfitAndLoss.expenses?.byCategory || [])
        .slice(0, 5)
        .map((entry: any) => ({ name: entry.category, amount: asNumber(entry.amount) })),
    };
  }

  if (reports.BalanceSheet) {
    packet.balanceSheet = {
      cash: asNumber(reports.BalanceSheet.bankAccounts?.total),
      totalAssets: asNumber(reports.BalanceSheet.totalAssets),
      totalLiabilities: asNumber(reports.BalanceSheet.totalLiabilities),
      totalEquity: asNumber(reports.BalanceSheet.totalEquity),
    };
  }

  if (reports.CashFlow) {
    packet.cashFlow = {
      netCashChange: asNumber(reports.CashFlow.netCashChange),
      operating: getSectionTotal(reports.CashFlow.sections, ["Operating Activities", "Net Cash Provided By Operating Activities"]),
      investing: getSectionTotal(reports.CashFlow.sections, ["Investing Activities", "Net Cash Provided By Investing Activities"]),
      financing: getSectionTotal(reports.CashFlow.sections, ["Financing Activities", "Net Cash Provided By Financing Activities"]),
    };
  }

  if (reports.AgedReceivables) {
    const { bucketTotals, topEntities, totalOpen } = buildAgingBuckets(
      reports.AgedReceivables.columns || [],
      reports.AgedReceivables.rows || []
    );

    packet.arAging = {
      totalOpenReceivables: totalOpen,
      buckets: bucketTotals,
      topCustomers: topEntities.slice(0, 5),
    };
  }

  if (reports.AgedPayables) {
    const { bucketTotals, topEntities, totalOpen } = buildAgingBuckets(
      reports.AgedPayables.columns || [],
      reports.AgedPayables.rows || []
    );

    packet.apAging = {
      totalOpenPayables: totalOpen,
      buckets: bucketTotals,
      topVendors: topEntities.slice(0, 5),
    };
  }

  if (reports.CustomerSales) {
    packet.salesByCustomer = {
      topCustomers: (reports.CustomerSales.rows || [])
        .map((row: any) => ({ name: row.name, total: asNumber(row.total) }))
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 5),
    };
  }

  if (reports.VendorExpenses) {
    packet.vendorExpenses = {
      topVendors: (reports.VendorExpenses.rows || [])
        .map((row: any) => ({ name: row.name, total: asNumber(row.total) }))
        .sort((a: any, b: any) => b.total - a.total)
        .slice(0, 5),
    };
  }

  return packet;
}

function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

export function buildQbCfoReportNarrative(packet: QbCfoReportPacket): string {
  const lines = ["QuickBooks report packet:"];

  if (packet.profitAndLoss) {
    lines.push(
      `P&L: income ${formatCurrency(packet.profitAndLoss.totalIncome)}, expenses ${formatCurrency(packet.profitAndLoss.totalExpenses)}, net income ${formatCurrency(packet.profitAndLoss.netIncome)}.`
    );
    if (packet.profitAndLoss.topExpenseCategories[0]) {
      const topExpense = packet.profitAndLoss.topExpenseCategories[0];
      lines.push(`Top expense category: ${topExpense.name} ${formatCurrency(topExpense.amount)}.`);
    }
  }

  if (packet.balanceSheet) {
    lines.push(
      `Balance Sheet: cash ${formatCurrency(packet.balanceSheet.cash)}, assets ${formatCurrency(packet.balanceSheet.totalAssets)}, liabilities ${formatCurrency(packet.balanceSheet.totalLiabilities)}, equity ${formatCurrency(packet.balanceSheet.totalEquity)}.`
    );
  }

  if (packet.cashFlow) {
    lines.push(
      `Cash Flow: net cash change ${formatCurrency(packet.cashFlow.netCashChange)}, operating ${formatCurrency(packet.cashFlow.operating)}, investing ${formatCurrency(packet.cashFlow.investing)}, financing ${formatCurrency(packet.cashFlow.financing)}.`
    );
  }

  if (packet.arAging) {
    lines.push(`A/R Aging: total open receivables ${formatCurrency(packet.arAging.totalOpenReceivables)}.`);
    const topCustomer = packet.arAging.topCustomers[0];
    if (topCustomer) {
      lines.push(`Largest receivable exposure: ${topCustomer.name} ${formatCurrency(topCustomer.total)}.`);
    }
  }

  if (packet.apAging) {
    lines.push(`A/P Aging: total open payables ${formatCurrency(packet.apAging.totalOpenPayables)}.`);
  }

  if (packet.salesByCustomer?.topCustomers[0]) {
    const topCustomer = packet.salesByCustomer.topCustomers[0];
    lines.push(`Top customer sales: ${topCustomer.name} ${formatCurrency(topCustomer.total)}.`);
  }

  if (packet.vendorExpenses?.topVendors[0]) {
    const topVendor = packet.vendorExpenses.topVendors[0];
    lines.push(`Top vendor expense: ${topVendor.name} ${formatCurrency(topVendor.total)}.`);
  }

  return lines.join("\n");
}
