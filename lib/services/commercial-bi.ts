import { differenceInDays, subDays } from "date-fns";

import { prisma } from "@/lib/db";
import { buildCustomerIdExclusionWhere, buildNullableCustomerIdExclusionWhere } from "@/lib/financial/hub-exclusions";
import { getFinancialHubExcludedCustomerIds } from "@/lib/financial/hub-exclusions-db";
import type { DateRangeParam } from "@/lib/types/financial-bi";

export type CommercialBIDateRange = {
  startDate: Date;
  endDate: Date;
};

export type CommercialBIOptions = {
  preset?: string;
  from?: string;
  to?: string;
  now?: Date;
};

export type CommercialBISellerRecord = {
  id: string;
  name: string | null;
  email: string;
};

export type CommercialBILeadRecord = {
  id: string;
  createdById: string | null;
  commercialOwnerId?: string | null;
  status: string;
  source: string;
  qualificationScore: number | null;
  createdAt: Date;
  convertedAt: Date | null;
};

export type CommercialBIDealRecord = {
  id: string;
  ownerId: string | null;
  commercialOwnerId?: string | null;
  customerId?: string | null;
  title: string;
  value: number;
  attributedValue?: number;
  invoiceCustomerIds?: string[];
  status: string;
  clint_deal_id: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CommercialBIInvoiceRecord = {
  id: string;
  ownerId: string | null;
  dealId: string | null;
  customerId?: string | null;
  invoiceNumber: string | null;
  amount: number;
  amountPaid: number | null;
  status: string;
  dueDate: Date;
  createdAt: Date;
  paidAt: Date | null;
  paymentMethod?: string | null;
};

export type CommercialBIContractRecord = {
  id: string;
  ownerId: string | null;
  dealId: string | null;
  customerId?: string | null;
  status: string;
  sentAt: Date | null;
  signedAt: Date | null;
  createdAt: Date;
};

export type CommercialBIInput = {
  now: Date;
  range: CommercialBIDateRange;
  sellers: CommercialBISellerRecord[];
  leads: CommercialBILeadRecord[];
  deals: CommercialBIDealRecord[];
  invoices: CommercialBIInvoiceRecord[];
  contracts: CommercialBIContractRecord[];
  lastClintSync: Date | null;
};

export type CommercialBISellerMetric = {
  sellerId: string;
  sellerName: string;
  sellerEmail: string;
  leads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  openDeals: number;
  openPipelineValue: number;
  wonDeals: number;
  wonValue: number;
  lostDeals: number;
  conversionRate: number;
  avgDealValue: number;
  avgCloseDays: number | null;
  pendingContracts: number;
  pendingInvoices: number;
  pendingInvoiceAmount: number;
  staleOpenDeals: number;
  clintLinkedDeals: number;
};

export type CommercialBIResponse = {
  dateRange: { from: string; to: string };
  freshness: {
    lastClintSync: string | null;
    state: "fresh" | "stale" | "missing";
    summary: string;
  };
  summary: {
    sellerCount: number;
    leadCount: number;
    qualifiedLeads: number;
    convertedLeads: number;
    openPipelineValue: number;
    openDeals: number;
    wonDeals: number;
    wonValue: number;
    lostDeals: number;
    conversionRate: number;
    avgDealValue: number;
    pendingContracts: number;
    pendingInvoices: number;
    pendingInvoiceAmount: number;
    staleOpenDeals: number;
    unassignedOpenDeals: number;
  };
  sellers: CommercialBISellerMetric[];
  sourceBreakdown: Array<{
    source: string;
    leads: number;
    qualified: number;
    converted: number;
    avgScore: number | null;
  }>;
  actionQueue: {
    staleDeals: Array<{
      id: string;
      title: string;
      sellerName: string;
      value: number;
      daysStale: number;
    }>;
    pendingInvoices: Array<{
      id: string;
      invoiceNumber: string;
      sellerName: string;
      openAmount: number;
      daysOverdue: number | null;
    }>;
    wonWithoutContract: Array<{
      id: string;
      title: string;
      sellerName: string;
      value: number;
    }>;
    wonWithoutInvoice: Array<{
      id: string;
      title: string;
      sellerName: string;
      value: number;
    }>;
    unassignedOpenDeals: Array<{
      id: string;
      title: string;
      value: number;
    }>;
  };
  closerBreakdown: Array<{
    sellerId: string;
    sellerName: string;
    products: Array<{
      product: string;
      wonDeals: number;
      wonValue: number;
      paidAmount: number;
      invoiceCount: number;
    }>;
    paymentMethods: Array<{
      method: string;
      paidAmount: number;
      invoiceCount: number;
    }>;
  }>;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeCommercialDateRange(preset?: string): DateRangeParam {
  switch (preset) {
    case "last7":
    case "last30":
    case "last90":
    case "thisMonth":
    case "lastMonth":
    case "thisYear":
    case "allTime":
    case "custom":
      return preset;
    default:
      return "last30";
  }
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function endOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function startOfUtcYear(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
}

export function getCommercialBIDateRange(options: CommercialBIOptions = {}): CommercialBIDateRange {
  const now = options.now ?? new Date();
  const endDate = options.to ? new Date(options.to) : now;

  switch (normalizeCommercialDateRange(options.preset)) {
    case "last7":
      return { startDate: subDays(now, 6), endDate };
    case "last30":
      return { startDate: subDays(now, 29), endDate };
    case "last90":
      return { startDate: subDays(now, 89), endDate };
    case "thisMonth":
      return { startDate: startOfUtcMonth(now), endDate };
    case "lastMonth": {
      const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      return { startDate: startOfUtcMonth(previousMonth), endDate: endOfUtcMonth(previousMonth) };
    }
    case "thisYear":
      return { startDate: startOfUtcYear(now), endDate };
    case "custom":
      return { startDate: options.from ? new Date(options.from) : subDays(now, 29), endDate };
    case "allTime":
    default:
      return { startDate: new Date("2020-01-01T00:00:00.000Z"), endDate };
  }
}

function openInvoiceAmount(invoice: CommercialBIInvoiceRecord): number {
  return Math.max(Number(invoice.amount || 0) - Number(invoice.amountPaid || 0), 0);
}

function collectedInvoiceAmount(invoice: CommercialBIInvoiceRecord): number {
  if (typeof invoice.amountPaid === "number" && invoice.amountPaid > 0) {
    return Math.min(Number(invoice.amount), Number(invoice.amountPaid));
  }
  if (invoice.status === "PAID") {
    return Number(invoice.amount || 0);
  }
  return 0;
}

function isWon(status: string): boolean {
  return status === "WON";
}

function isLost(status: string): boolean {
  return status === "LOST";
}

function isOpen(status: string): boolean {
  return status === "OPEN";
}

function isQualifiedLead(status: string): boolean {
  return status === "QUALIFIED" || status === "CONVERTED";
}

function isConvertedLead(status: string): boolean {
  return status === "CONVERTED";
}

function isPendingContract(status: string): boolean {
  return status === "SENT_FOR_SIGNATURE" || status === "VIEWED";
}

function isPendingInvoice(status: string): boolean {
  return status === "SENT" || status === "OVERDUE" || status === "PARTIALLY_PAID";
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function conversionRate(won: number, lost: number): number {
  const resolved = won + lost;
  return resolved > 0 ? round1((won / resolved) * 100) : 0;
}

function sellerNameById(sellerMap: Map<string, CommercialBISellerRecord>, sellerId: string | null): string {
  if (!sellerId) return "Sem vendedor";
  const seller = sellerMap.get(sellerId);
  return seller?.name || seller?.email || "Sem vendedor";
}

function leadCommercialOwnerId(lead: CommercialBILeadRecord): string | null {
  return lead.commercialOwnerId || lead.createdById || null;
}

function dealCommercialOwnerId(deal: CommercialBIDealRecord): string | null {
  return deal.commercialOwnerId || deal.ownerId || null;
}

function dealCommercialValue(deal: CommercialBIDealRecord): number {
  const value = Number(deal.value || 0);
  if (value > 0) return value;
  return Number(deal.attributedValue || 0);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function normalizeProductLabel(value: string): string {
  const title = value.trim();
  if (!title) return "OUTROS";
  const upper = title.toUpperCase();
  if (upper.includes("ADVANCED")) return "ADVANCED";
  if (upper.includes("PASS")) return "PASS";
  if (upper.includes("COMBO")) return "COMBO";
  return title.length > 48 ? `${title.slice(0, 45)}...` : title;
}

function normalizePaymentMethodLabel(value: string | null | undefined): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "UNSPECIFIED";
  if (normalized.includes("ach") || normalized.includes("bank")) return "ACH";
  if (normalized.includes("card") || normalized.includes("credit") || normalized.includes("debit")) return "CARD";
  if (normalized.includes("pix")) return "PIX";
  if (normalized.includes("cash")) return "CASH";
  if (normalized.includes("check")) return "CHECK";
  if (normalized.includes("quickbooks")) return "QUICKBOOKS";
  return normalized.toUpperCase();
}

function resolveLeadOwnerFromMetadata(
  metadata: unknown,
  sellerByEmail: Map<string, string>
): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = metadata as Record<string, any>;
  const pipedriveData = record.pipedrive_person_data;
  const ownerEmail =
    normalizeEmail(pipedriveData?.owner_id?.email) ||
    normalizeEmail(pipedriveData?.owner_email) ||
    normalizeEmail(record.owner_id?.email) ||
    normalizeEmail(record.owner_email);

  return ownerEmail ? sellerByEmail.get(ownerEmail) ?? null : null;
}

function firstSellerOwnerId(ownerIds: Array<string | null | undefined>, sellerIds: Set<string>): string | null {
  return ownerIds.find((ownerId): ownerId is string => Boolean(ownerId && sellerIds.has(ownerId))) ?? null;
}

function isExcludedCustomerId(customerId: string | null | undefined, excludedCustomerIds: Set<string>): boolean {
  return Boolean(customerId && excludedCustomerIds.has(customerId));
}

function buildFreshness(now: Date, lastClintSync: Date | null): CommercialBIResponse["freshness"] {
  if (!lastClintSync) {
    return {
      lastClintSync: null,
      state: "missing",
      summary: "Sem registro de sync do Clint.",
    };
  }

  const hours = Math.round((now.getTime() - lastClintSync.getTime()) / 36_000) / 100;
  const state = hours <= 24 ? "fresh" : "stale";
  return {
    lastClintSync: lastClintSync.toISOString(),
    state,
    summary: state === "fresh"
      ? `Clint sincronizado ha ${hours.toFixed(1)}h.`
      : `Clint sem sync recente ha ${hours.toFixed(1)}h.`,
  };
}

export function buildCommercialBIFromRecords(input: CommercialBIInput): CommercialBIResponse {
  const sellerMap = new Map(input.sellers.map((seller) => [seller.id, seller]));
  const sellerIds = new Set(input.sellers.map((seller) => seller.id));
  const staleCutoff = subDays(input.now, 14);
  const sellerMetrics = input.sellers.map((seller): CommercialBISellerMetric => {
    const sellerLeads = input.leads.filter((lead) => leadCommercialOwnerId(lead) === seller.id);
    const sellerDeals = input.deals.filter((deal) => dealCommercialOwnerId(deal) === seller.id);
    const sellerOpenDeals = sellerDeals.filter((deal) => isOpen(deal.status));
    const sellerWonDeals = sellerDeals.filter((deal) => isWon(deal.status));
    const sellerLostDeals = sellerDeals.filter((deal) => isLost(deal.status));
    const sellerPendingContracts = input.contracts.filter((contract) => contract.ownerId === seller.id && isPendingContract(contract.status));
    const sellerPendingInvoices = input.invoices.filter((invoice) => invoice.ownerId === seller.id && isPendingInvoice(invoice.status));
    const closeDays = sellerWonDeals
      .map((deal) => differenceInDays(deal.updatedAt, deal.createdAt))
      .filter((days) => days >= 0);
    const wonValue = sellerWonDeals.reduce((sum, deal) => sum + dealCommercialValue(deal), 0);
    const pendingInvoiceAmount = sellerPendingInvoices.reduce((sum, invoice) => sum + openInvoiceAmount(invoice), 0);

    return {
      sellerId: seller.id,
      sellerName: seller.name || seller.email,
      sellerEmail: seller.email,
      leads: sellerLeads.length,
      qualifiedLeads: sellerLeads.filter((lead) => isQualifiedLead(lead.status)).length,
      convertedLeads: sellerLeads.filter((lead) => isConvertedLead(lead.status)).length,
      openDeals: sellerOpenDeals.length,
      openPipelineValue: sellerOpenDeals.reduce((sum, deal) => sum + dealCommercialValue(deal), 0),
      wonDeals: sellerWonDeals.length,
      wonValue,
      lostDeals: sellerLostDeals.length,
      conversionRate: conversionRate(sellerWonDeals.length, sellerLostDeals.length),
      avgDealValue: sellerWonDeals.length > 0 ? Math.round(wonValue / sellerWonDeals.length) : 0,
      avgCloseDays: average(closeDays),
      pendingContracts: sellerPendingContracts.length,
      pendingInvoices: sellerPendingInvoices.length,
      pendingInvoiceAmount,
      staleOpenDeals: sellerOpenDeals.filter((deal) => deal.updatedAt < staleCutoff).length,
      clintLinkedDeals: sellerDeals.filter((deal) => Boolean(deal.clint_deal_id)).length,
    };
  }).sort((a, b) => b.wonValue - a.wonValue || b.openPipelineValue - a.openPipelineValue);

  const openDeals = input.deals.filter((deal) => isOpen(deal.status));
  const wonDeals = input.deals.filter((deal) => sellerIds.has(dealCommercialOwnerId(deal) || "") && isWon(deal.status));
  const lostDeals = input.deals.filter((deal) => sellerIds.has(dealCommercialOwnerId(deal) || "") && isLost(deal.status));
  const pendingContracts = input.contracts.filter((contract) => sellerIds.has(contract.ownerId || "") && isPendingContract(contract.status));
  const pendingInvoices = input.invoices.filter((invoice) => sellerIds.has(invoice.ownerId || "") && isPendingInvoice(invoice.status));
  const wonDealIdsWithContracts = new Set(input.contracts.map((contract) => contract.dealId).filter(Boolean));
  const wonDealIdsWithInvoices = new Set(input.invoices.map((invoice) => invoice.dealId).filter(Boolean));
  const wonValue = wonDeals.reduce((sum, deal) => sum + dealCommercialValue(deal), 0);
  const pendingInvoiceAmount = pendingInvoices.reduce((sum, invoice) => sum + openInvoiceAmount(invoice), 0);

  const sourceMap = new Map<string, { leads: number; qualified: number; converted: number; scores: number[] }>();
  for (const lead of input.leads) {
    const entry = sourceMap.get(lead.source) ?? { leads: 0, qualified: 0, converted: 0, scores: [] };
    entry.leads += 1;
    if (isQualifiedLead(lead.status)) entry.qualified += 1;
    if (isConvertedLead(lead.status)) entry.converted += 1;
    if (lead.qualificationScore && lead.qualificationScore > 0) {
      entry.scores.push(lead.qualificationScore);
    }
    sourceMap.set(lead.source, entry);
  }

  const sourceBreakdown = Array.from(sourceMap.entries())
    .map(([source, data]) => ({
      source,
      leads: data.leads,
      qualified: data.qualified,
      converted: data.converted,
      avgScore: average(data.scores),
    }))
    .sort((a, b) => b.leads - a.leads || a.source.localeCompare(b.source));

  const allStaleDeals = openDeals
    .filter((deal) => deal.updatedAt < staleCutoff)
    .map((deal) => ({
      id: deal.id,
      title: deal.title,
      sellerName: sellerNameById(sellerMap, dealCommercialOwnerId(deal)),
      value: dealCommercialValue(deal),
      daysStale: differenceInDays(input.now, deal.updatedAt),
    }))
    .sort((a, b) => b.value - a.value);

  const dealById = new Map(input.deals.map((deal) => [deal.id, deal]));
  const closerBreakdown = input.sellers.map((seller) => {
    const wonByProduct = new Map<string, { wonDeals: number; wonValue: number; paidAmount: number; invoiceCount: number }>();
    const paymentMethods = new Map<string, { paidAmount: number; invoiceCount: number }>();

    const sellerWonDeals = input.deals.filter((deal) => dealCommercialOwnerId(deal) === seller.id && isWon(deal.status));
    for (const deal of sellerWonDeals) {
      const product = normalizeProductLabel(deal.title);
      const current = wonByProduct.get(product) ?? { wonDeals: 0, wonValue: 0, paidAmount: 0, invoiceCount: 0 };
      current.wonDeals += 1;
      current.wonValue += dealCommercialValue(deal);
      wonByProduct.set(product, current);
    }

    const sellerInvoices = input.invoices.filter((invoice) => invoice.ownerId === seller.id);
    for (const invoice of sellerInvoices) {
      const paidAmount = collectedInvoiceAmount(invoice);
      const method = normalizePaymentMethodLabel(invoice.paymentMethod);
      const methodCurrent = paymentMethods.get(method) ?? { paidAmount: 0, invoiceCount: 0 };
      methodCurrent.paidAmount += paidAmount;
      methodCurrent.invoiceCount += 1;
      paymentMethods.set(method, methodCurrent);

      if (!invoice.dealId) continue;
      const deal = dealById.get(invoice.dealId);
      if (!deal) continue;
      const product = normalizeProductLabel(deal.title);
      const productCurrent = wonByProduct.get(product) ?? { wonDeals: 0, wonValue: 0, paidAmount: 0, invoiceCount: 0 };
      productCurrent.paidAmount += paidAmount;
      productCurrent.invoiceCount += 1;
      wonByProduct.set(product, productCurrent);
    }

    return {
      sellerId: seller.id,
      sellerName: seller.name || seller.email,
      products: Array.from(wonByProduct.entries())
        .map(([product, data]) => ({
          product,
          wonDeals: data.wonDeals,
          wonValue: data.wonValue,
          paidAmount: data.paidAmount,
          invoiceCount: data.invoiceCount,
        }))
        .sort((a, b) => b.wonValue - a.wonValue || b.paidAmount - a.paidAmount),
      paymentMethods: Array.from(paymentMethods.entries())
        .map(([method, data]) => ({
          method,
          paidAmount: data.paidAmount,
          invoiceCount: data.invoiceCount,
        }))
        .sort((a, b) => b.paidAmount - a.paidAmount || b.invoiceCount - a.invoiceCount),
    };
  });

  return {
    dateRange: {
      from: input.range.startDate.toISOString(),
      to: input.range.endDate.toISOString(),
    },
    freshness: buildFreshness(input.now, input.lastClintSync),
    summary: {
      sellerCount: input.sellers.length,
      leadCount: input.leads.length,
      qualifiedLeads: input.leads.filter((lead) => isQualifiedLead(lead.status)).length,
      convertedLeads: input.leads.filter((lead) => isConvertedLead(lead.status)).length,
      openPipelineValue: openDeals.reduce((sum, deal) => sum + dealCommercialValue(deal), 0),
      openDeals: openDeals.length,
      wonDeals: wonDeals.length,
      wonValue,
      lostDeals: lostDeals.length,
      conversionRate: conversionRate(wonDeals.length, lostDeals.length),
      avgDealValue: wonDeals.length > 0 ? Math.round(wonValue / wonDeals.length) : 0,
      pendingContracts: pendingContracts.length,
      pendingInvoices: pendingInvoices.length,
      pendingInvoiceAmount,
      staleOpenDeals: allStaleDeals.length,
      unassignedOpenDeals: openDeals.filter((deal) => !dealCommercialOwnerId(deal)).length,
    },
    sellers: sellerMetrics,
    sourceBreakdown,
    actionQueue: {
      staleDeals: allStaleDeals.slice(0, 10),
      pendingInvoices: pendingInvoices
        .map((invoice) => ({
          id: invoice.id,
          invoiceNumber: invoice.invoiceNumber || invoice.id,
          sellerName: sellerNameById(sellerMap, invoice.ownerId),
          openAmount: openInvoiceAmount(invoice),
          daysOverdue: invoice.dueDate < input.now ? differenceInDays(input.now, invoice.dueDate) : null,
        }))
        .sort((a, b) => b.openAmount - a.openAmount)
        .slice(0, 10),
      wonWithoutContract: wonDeals
        .filter((deal) => !wonDealIdsWithContracts.has(deal.id))
        .map((deal) => ({
          id: deal.id,
          title: deal.title,
          sellerName: sellerNameById(sellerMap, dealCommercialOwnerId(deal)),
          value: dealCommercialValue(deal),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      wonWithoutInvoice: wonDeals
        .filter((deal) => !wonDealIdsWithInvoices.has(deal.id))
        .map((deal) => ({
          id: deal.id,
          title: deal.title,
          sellerName: sellerNameById(sellerMap, dealCommercialOwnerId(deal)),
          value: dealCommercialValue(deal),
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
      unassignedOpenDeals: openDeals
        .filter((deal) => !dealCommercialOwnerId(deal))
        .map((deal) => ({ id: deal.id, title: deal.title, value: dealCommercialValue(deal) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    },
    closerBreakdown,
  };
}

export async function getCommercialBIData(options: CommercialBIOptions = {}): Promise<CommercialBIResponse> {
  const now = options.now ?? new Date();
  const range = getCommercialBIDateRange(options);
  const dateFilter = { gte: range.startDate, lte: range.endDate };
  const excludedCustomerIds = await getFinancialHubExcludedCustomerIds();
  const excludedCustomerIdSet = new Set(excludedCustomerIds);
  const customerVisibilityWhere = buildCustomerIdExclusionWhere(excludedCustomerIds);
  const nullableDealCustomerVisibilityWhere = buildNullableCustomerIdExclusionWhere(excludedCustomerIds);

  const sellers = await prisma.user.findMany({
    where: { active: true, role: "COMMERCIAL" },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  const sellerIds = sellers.map((seller) => seller.id);
  const sellerIdSet = new Set(sellerIds);
  const sellerByEmail = new Map(
    sellers.map((seller) => [seller.email.trim().toLowerCase(), seller.id])
  );

  const [leads, deals, invoices, contracts, systemConfig] = await Promise.all([
    prisma.lead.findMany({
      where: { createdAt: dateFilter },
      select: {
        id: true,
        createdById: true,
        metadata: true,
        status: true,
        source: true,
        qualificationScore: true,
        createdAt: true,
        convertedAt: true,
      },
    }),
    prisma.deal.findMany({
      where: {
        AND: [
          nullableDealCustomerVisibilityWhere,
          {
            OR: [
              { ownerId: { in: sellerIds } },
              { invoices: { some: { ownerId: { in: sellerIds }, ...customerVisibilityWhere } } },
              { customer: { createdById: { in: sellerIds } } },
              { clint_deal_id: { not: null } },
            ],
          },
          {
            OR: [
              { status: "OPEN" },
              { createdAt: dateFilter },
              { updatedAt: dateFilter },
              { invoices: { some: { createdAt: dateFilter, ...customerVisibilityWhere } } },
              { invoices: { some: { paidAt: dateFilter, ...customerVisibilityWhere } } },
              { invoices: { some: { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] }, ...customerVisibilityWhere } } },
            ],
          },
        ],
      },
      select: {
        id: true,
        ownerId: true,
        customerId: true,
        title: true,
        value: true,
        status: true,
        clint_deal_id: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { createdById: true } },
        invoices: {
          select: {
            ownerId: true,
            customerId: true,
            amount: true,
            createdAt: true,
            paidAt: true,
            status: true,
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        ownerId: { in: sellerIds },
        ...customerVisibilityWhere,
        OR: [
          { createdAt: dateFilter },
          { paidAt: dateFilter },
          { status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] } },
        ],
      },
      select: {
        id: true,
        ownerId: true,
        dealId: true,
        customerId: true,
        invoiceNumber: true,
        amount: true,
        amountPaid: true,
        status: true,
        dueDate: true,
        createdAt: true,
        paidAt: true,
        paymentMethod: true,
      },
    }),
    prisma.contract.findMany({
      where: {
        AND: [
          customerVisibilityWhere,
          {
            OR: [
              { deal: { ownerId: { in: sellerIds } } },
              { invoices: { some: { ownerId: { in: sellerIds }, ...customerVisibilityWhere } } },
              { customer: { createdById: { in: sellerIds } } },
            ],
          },
          {
            OR: [
              { createdAt: dateFilter },
              { sentAt: dateFilter },
              { signedAt: dateFilter },
              { status: { in: ["SENT_FOR_SIGNATURE", "VIEWED"] } },
            ],
          },
        ],
      },
      select: {
        id: true,
        dealId: true,
        customerId: true,
        status: true,
        sentAt: true,
        signedAt: true,
        createdAt: true,
        deal: { select: { ownerId: true } },
        customer: { select: { createdById: true } },
        invoices: { select: { ownerId: true } },
      },
    }),
    prisma.systemConfig.findUnique({
      where: { id: "system" },
      select: { last_clint_sync: true },
    }),
  ]);

  const visibleDeals = deals.filter((deal) => {
    if (isExcludedCustomerId(deal.customerId, excludedCustomerIdSet)) {
      return false;
    }
    return !deal.invoices.some((invoice) => isExcludedCustomerId(invoice.customerId, excludedCustomerIdSet));
  });

  const visibleInvoices = invoices.filter((invoice) => !isExcludedCustomerId(invoice.customerId, excludedCustomerIdSet));
  const visibleContracts = contracts.filter((contract) => !isExcludedCustomerId(contract.customerId, excludedCustomerIdSet));

  return buildCommercialBIFromRecords({
    now,
    range,
    sellers,
    leads: leads.map((lead) => {
      const directOwnerId = firstSellerOwnerId([lead.createdById], sellerIdSet);
      return {
        ...lead,
        commercialOwnerId: directOwnerId ?? resolveLeadOwnerFromMetadata(lead.metadata, sellerByEmail),
        status: String(lead.status),
        source: String(lead.source),
      };
    }),
    deals: visibleDeals.map((deal) => {
      const invoiceOwnerId = firstSellerOwnerId(deal.invoices.map((invoice) => invoice.ownerId), sellerIdSet);
      const customerOwnerId = firstSellerOwnerId([deal.customer?.createdById], sellerIdSet);
      const attributedValue = deal.invoices.reduce((sum, invoice) => sum + Number(invoice.amount || 0), 0);
      return {
        id: deal.id,
        ownerId: deal.ownerId,
        commercialOwnerId: firstSellerOwnerId([deal.ownerId], sellerIdSet) ?? invoiceOwnerId ?? customerOwnerId,
        customerId: deal.customerId,
        title: deal.title,
        value: Number(deal.value || 0),
        attributedValue,
        invoiceCustomerIds: deal.invoices.map((invoice) => invoice.customerId).filter((value): value is string => Boolean(value)),
        status: String(deal.status),
        clint_deal_id: deal.clint_deal_id,
        createdAt: deal.createdAt,
        updatedAt: deal.updatedAt,
      };
    }),
    invoices: visibleInvoices.map((invoice) => ({
      ...invoice,
      amount: Number(invoice.amount || 0),
      amountPaid: Number(invoice.amountPaid || 0),
      status: String(invoice.status),
    })),
    contracts: visibleContracts.map((contract) => ({
      id: contract.id,
      ownerId: firstSellerOwnerId(
        [
          contract.deal.ownerId,
          ...contract.invoices.map((invoice) => invoice.ownerId),
          contract.customer.createdById,
        ],
        sellerIdSet
      ),
      dealId: contract.dealId,
      customerId: contract.customerId,
      status: String(contract.status),
      sentAt: contract.sentAt,
      signedAt: contract.signedAt,
      createdAt: contract.createdAt,
    })),
    lastClintSync: systemConfig?.last_clint_sync ?? null,
  });
}
