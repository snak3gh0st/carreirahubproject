// lib/services/qb-report-parser.ts

interface QbReportRow {
  type?: string;
  Header?: { ColData: Array<{ value: string }> };
  Summary?: { ColData: Array<{ value: string }> };
  Rows?: { Row: QbReportRow[] };
  ColData?: Array<{ value: string }>;
  group?: string;
}

interface QbReport {
  Header?: { StartPeriod?: string; EndPeriod?: string; ReportName?: string };
  Columns?: { Column: Array<{ ColTitle: string; ColType: string }> };
  Rows?: { Row: QbReportRow[] };
}

export interface ParsedPnL {
  months: string[];
  income: { total: number; byMonth: number[] };
  cogs: { total: number; byMonth: number[] };
  expenses: { total: number; byMonth: number[]; byCategory: Array<{ category: string; amount: number }> };
  netIncome: { total: number; byMonth: number[] };
}

export interface ParsedBalanceSheet {
  bankAccounts: { total: number; accounts: Array<{ name: string; balance: number }> };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

function parseNumber(value: string | undefined): number {
  if (!value || value === "") return 0;
  return parseFloat(value.replace(/,/g, "")) || 0;
}

function extractMonthColumns(report: QbReport): string[] {
  if (!report.Columns?.Column) return [];
  return report.Columns.Column
    .filter((col) => col.ColType === "Money" && col.ColTitle !== "Total")
    .map((col) => col.ColTitle);
}

function findSectionByGroup(rows: QbReportRow[], groupName: string): QbReportRow | undefined {
  return rows.find((row) => row.group === groupName || row.Header?.ColData?.[0]?.value === groupName);
}

function extractSectionTotal(section: QbReportRow | undefined, colCount: number): { total: number; byMonth: number[] } {
  if (!section?.Summary?.ColData) {
    return { total: 0, byMonth: new Array(colCount).fill(0) };
  }
  const colData = section.Summary.ColData;
  const total = parseNumber(colData[colData.length - 1]?.value);
  const byMonth = colData.slice(1, colData.length - 1).map((c) => parseNumber(c.value));
  if (byMonth.length === 0) return { total, byMonth: new Array(colCount).fill(0) };
  return { total, byMonth };
}

function extractCategoryBreakdown(section: QbReportRow | undefined): Array<{ category: string; amount: number }> {
  if (!section?.Rows?.Row) return [];
  const categories: Array<{ category: string; amount: number }> = [];

  for (const row of section.Rows.Row) {
    if (row.ColData && row.ColData.length >= 2) {
      const name = row.ColData[0]?.value || "Other";
      const amount = parseNumber(row.ColData[row.ColData.length - 1]?.value);
      if (amount > 0) {
        categories.push({ category: name, amount });
      }
    }
    if (row.Rows?.Row) {
      for (const subRow of row.Rows.Row) {
        if (subRow.ColData && subRow.ColData.length >= 2) {
          const name = subRow.ColData[0]?.value || "Other";
          const amount = parseNumber(subRow.ColData[subRow.ColData.length - 1]?.value);
          if (amount > 0) {
            categories.push({ category: name, amount });
          }
        }
      }
    }
  }

  return categories.sort((a, b) => b.amount - a.amount);
}

export function parseProfitAndLoss(raw: QbReport): ParsedPnL {
  const months = extractMonthColumns(raw);
  const rows = raw.Rows?.Row || [];
  const colCount = months.length;

  const incomeSection = findSectionByGroup(rows, "Income");
  const cogsSection = findSectionByGroup(rows, "CostOfGoodsSold");
  const expenseSection = findSectionByGroup(rows, "Expenses");
  const netIncomeSection = findSectionByGroup(rows, "NetIncome");

  const income = extractSectionTotal(incomeSection, colCount);
  const cogs = extractSectionTotal(cogsSection, colCount);
  const expenses = extractSectionTotal(expenseSection, colCount);
  const netIncome = extractSectionTotal(netIncomeSection, colCount);
  const byCategory = extractCategoryBreakdown(expenseSection);

  return {
    months,
    income,
    cogs,
    expenses: { ...expenses, byCategory },
    netIncome,
  };
}

export function parseBalanceSheet(raw: QbReport): ParsedBalanceSheet {
  const rows = raw.Rows?.Row || [];

  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;
  const bankAccounts: Array<{ name: string; balance: number }> = [];

  for (const section of rows) {
    const sectionName = section.Header?.ColData?.[0]?.value || section.group || "";

    if (sectionName === "Assets" || section.group === "Assets") {
      totalAssets = parseNumber(section.Summary?.ColData?.[1]?.value);

      if (section.Rows?.Row) {
        for (const subSection of section.Rows.Row) {
          const subName = subSection.Header?.ColData?.[0]?.value || "";
          if (subName.includes("Bank") || subName.includes("Cash")) {
            if (subSection.Rows?.Row) {
              for (const acctRow of subSection.Rows.Row) {
                if (acctRow.ColData && acctRow.ColData.length >= 2) {
                  bankAccounts.push({
                    name: acctRow.ColData[0]?.value || "Bank Account",
                    balance: parseNumber(acctRow.ColData[1]?.value),
                  });
                }
              }
            }
          }
        }
      }
    }

    if (sectionName === "Liabilities" || section.group === "Liabilities") {
      totalLiabilities = parseNumber(section.Summary?.ColData?.[1]?.value);
    }

    if (sectionName === "Equity" || section.group === "Equity") {
      totalEquity = parseNumber(section.Summary?.ColData?.[1]?.value);
    }
  }

  const bankTotal = bankAccounts.reduce((sum, a) => sum + a.balance, 0);

  return {
    bankAccounts: { total: bankTotal, accounts: bankAccounts },
    totalAssets,
    totalLiabilities,
    totalEquity,
  };
}
