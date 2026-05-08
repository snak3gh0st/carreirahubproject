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

export interface ParsedPnlCategory {
  category: string;
  amount: number;
  byMonth?: number[];
}

export interface ParsedPnL {
  months: string[];
  income: { total: number; byMonth: number[] };
  cogs: { total: number; byMonth: number[]; byCategory: ParsedPnlCategory[] };
  expenses: { total: number; byMonth: number[]; byCategory: ParsedPnlCategory[] };
  netIncome: { total: number; byMonth: number[] };
}

export interface ParsedBalanceSheet {
  bankAccounts: { total: number; accounts: Array<{ name: string; balance: number }> };
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface ParsedCashFlow {
  sections: Array<{ name: string; total: number }>;
  netCashChange: number;
}

export interface ParsedAgingSummary {
  columns: string[];
  rows: Array<{ name: string; values: number[]; total: number }>;
}

export interface ParsedEntitySummary {
  rows: Array<{ name: string; total: number }>;
}

function isParsedProfitAndLoss(raw: unknown): raw is ParsedPnL {
  if (!raw || typeof raw !== "object") return false;
  const candidate = raw as Partial<ParsedPnL>;
  return Array.isArray(candidate.months)
    && !!candidate.income
    && !!candidate.cogs
    && !!candidate.expenses
    && !!candidate.netIncome;
}

function isParsedBalanceSheet(raw: unknown): raw is ParsedBalanceSheet {
  if (!raw || typeof raw !== "object") return false;
  const candidate = raw as Partial<ParsedBalanceSheet>;
  return !!candidate.bankAccounts
    && typeof candidate.totalAssets === "number"
    && typeof candidate.totalLiabilities === "number"
    && typeof candidate.totalEquity === "number";
}

function isParsedCashFlow(raw: unknown): raw is ParsedCashFlow {
  if (!raw || typeof raw !== "object") return false;
  const candidate = raw as Partial<ParsedCashFlow>;
  return Array.isArray(candidate.sections) && typeof candidate.netCashChange === "number";
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

function findSectionByGroup(rows: QbReportRow[], groupNames: string | string[]): QbReportRow | undefined {
  const names = Array.isArray(groupNames) ? groupNames : [groupNames];
  for (const row of rows) {
    const headerValue = row.Header?.ColData?.[0]?.value;
    if (names.includes(String(row.group)) || (headerValue && names.includes(headerValue))) {
      return row;
    }
    if (row.Rows?.Row) {
      const nested = findSectionByGroup(row.Rows.Row, names);
      if (nested) return nested;
    }
  }
  return undefined;
}

function flattenDataRows(rows: QbReportRow[]): QbReportRow[] {
  const flat: QbReportRow[] = [];
  for (const row of rows) {
    if (row.ColData && row.ColData.length > 0) {
      flat.push(row);
    }
    if (row.Rows?.Row) {
      flat.push(...flattenDataRows(row.Rows.Row));
    }
  }
  return flat;
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

function readCategoryRow(row: QbReportRow): ParsedPnlCategory | null {
  if (!row.ColData || row.ColData.length < 2) return null;

  const name = row.ColData[0]?.value || "Other";
  const amount = parseNumber(row.ColData[row.ColData.length - 1]?.value);
  if (amount <= 0) return null;

  const byMonth = row.ColData.length > 2
    ? row.ColData.slice(1, row.ColData.length - 1).map((c) => parseNumber(c.value))
    : [];

  return {
    category: name,
    amount,
    ...(byMonth.length > 0 ? { byMonth } : {}),
  };
}

function extractCategoryBreakdown(section: QbReportRow | undefined): ParsedPnlCategory[] {
  if (!section?.Rows?.Row) return [];
  const categories: ParsedPnlCategory[] = [];

  for (const row of section.Rows.Row) {
    const category = readCategoryRow(row);
    if (category) {
      categories.push(category);
    }
    if (row.Rows?.Row) {
      for (const subRow of row.Rows.Row) {
        const subCategory = readCategoryRow(subRow);
        if (subCategory) {
          categories.push(subCategory);
        }
      }
    }
  }

  return categories.sort((a, b) => b.amount - a.amount);
}

export function parseProfitAndLoss(raw: QbReport): ParsedPnL {
  if (isParsedProfitAndLoss(raw)) {
    return {
      ...raw,
      cogs: { ...raw.cogs, byCategory: raw.cogs.byCategory ?? [] },
      expenses: { ...raw.expenses, byCategory: raw.expenses.byCategory ?? [] },
    };
  }

  const months = extractMonthColumns(raw);
  const rows = raw.Rows?.Row || [];
  const colCount = months.length;

  const incomeSection = findSectionByGroup(rows, "Income");
  const cogsSection = findSectionByGroup(rows, ["COGS", "CostOfGoodsSold", "Cost of Goods Sold"]);
  const expenseSection = findSectionByGroup(rows, "Expenses");
  const netIncomeSection = findSectionByGroup(rows, "NetIncome");

  const income = extractSectionTotal(incomeSection, colCount);
  const cogs = extractSectionTotal(cogsSection, colCount);
  const expenses = extractSectionTotal(expenseSection, colCount);
  const netIncome = extractSectionTotal(netIncomeSection, colCount);
  const cogsByCategory = extractCategoryBreakdown(cogsSection);
  const byCategory = extractCategoryBreakdown(expenseSection);

  return {
    months,
    income,
    cogs: { ...cogs, byCategory: cogsByCategory },
    expenses: { ...expenses, byCategory },
    netIncome,
  };
}

export function parseBalanceSheet(raw: QbReport): ParsedBalanceSheet {
  if (isParsedBalanceSheet(raw)) {
    return raw;
  }

  const rows = raw.Rows?.Row || [];
  const totalAssetsSection = findSectionByGroup(rows, ["TotalAssets", "Assets", "ASSETS"]);
  const liabilitiesSection = findSectionByGroup(rows, ["Liabilities", "LIABILITIES"]);
  const equitySection = findSectionByGroup(rows, ["Equity", "EQUITY"]);
  const bankAccountsSection = findSectionByGroup(rows, ["BankAccounts", "Bank Accounts", "Cash and cash equivalents"]);

  const totalAssets = parseNumber(totalAssetsSection?.Summary?.ColData?.[1]?.value);
  const totalLiabilities = parseNumber(liabilitiesSection?.Summary?.ColData?.[1]?.value);
  const totalEquity = parseNumber(equitySection?.Summary?.ColData?.[1]?.value);

  const bankAccounts: Array<{ name: string; balance: number }> = [];
  for (const acctRow of bankAccountsSection?.Rows?.Row || []) {
    if (acctRow.ColData && acctRow.ColData.length >= 2) {
      bankAccounts.push({
        name: acctRow.ColData[0]?.value || "Bank Account",
        balance: parseNumber(acctRow.ColData[1]?.value),
      });
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

export function parseCashFlow(raw: QbReport): ParsedCashFlow {
  if (isParsedCashFlow(raw)) {
    return raw;
  }

  const rows = raw.Rows?.Row || [];
  const sections = rows
    .map((row) => ({
      name: row.Header?.ColData?.[0]?.value || row.group || "",
      total: parseNumber(row.Summary?.ColData?.[row.Summary.ColData.length - 1]?.value),
    }))
    .filter((row) => row.name && row.total !== 0);

  const normalized = (value: string) => value.trim().toLowerCase();
  const netCashNames = [
    "net cash increase",
    "net change in cash",
    "net cash increase for period",
    "cashincrease",
  ];
  const cashActivityNames = [
    "operating activities",
    "investing activities",
    "financing activities",
    "operatingactivities",
    "investingactivities",
    "financingactivities",
  ];
  const netCashChange = sections.find((section) =>
    netCashNames.includes(normalized(section.name))
  )?.total || sections
    .filter((section) => cashActivityNames.includes(normalized(section.name)))
    .reduce((sum, section) => sum + section.total, 0);

  return { sections, netCashChange };
}

export function ensureParsedProfitAndLoss(raw: ParsedPnL | QbReport): ParsedPnL {
  return parseProfitAndLoss(raw as QbReport);
}

export function ensureParsedBalanceSheet(raw: ParsedBalanceSheet | QbReport): ParsedBalanceSheet {
  return parseBalanceSheet(raw as QbReport);
}

export function ensureParsedCashFlow(raw: ParsedCashFlow | QbReport): ParsedCashFlow {
  return parseCashFlow(raw as QbReport);
}

export function parseAgingSummary(raw: QbReport): ParsedAgingSummary {
  const columns = (raw.Columns?.Column || [])
    .slice(1)
    .map((column) => column.ColTitle)
    .filter(Boolean);

  const rows = flattenDataRows(raw.Rows?.Row || [])
    .map((row) => {
      const colData = row.ColData || [];
      const name = colData[0]?.value || "";
      const values = colData.slice(1).map((col) => parseNumber(col.value));
      const total = values[values.length - 1] || values.reduce((sum, value) => sum + value, 0);
      return { name, values, total };
    })
    .filter((row) => row.name && row.total > 0);

  return { columns, rows };
}

export function parseEntitySummaryReport(raw: QbReport): ParsedEntitySummary {
  const rows = flattenDataRows(raw.Rows?.Row || [])
    .map((row) => {
      const colData = row.ColData || [];
      return {
        name: colData[0]?.value || "",
        total: parseNumber(colData[colData.length - 1]?.value),
      };
    })
    .filter((row) => row.name && row.total > 0)
    .sort((a, b) => b.total - a.total);

  return { rows };
}
