import type { DateRangeParam } from "@/lib/types/financial-bi";
import type { ExecutiveBIResponse } from "@/lib/types/executive-bi";

export interface LegacyExecutiveCard {
  label: string;
  value: string;
  helper: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildLegacyExecutiveCards(data: ExecutiveBIResponse): LegacyExecutiveCard[] {
  const { health } = data.overview;

  return [
    {
      label: "Revenue",
      value: formatCurrency(health.revenue),
      helper: "Canonical QuickBooks revenue",
    },
    {
      label: "Cash On Hand",
      value: formatCurrency(health.cashOnHand),
      helper: "Canonical executive liquidity",
    },
    {
      label: "Open AR",
      value: formatCurrency(health.openAr),
      helper: "Canonical receivables outstanding",
    },
    {
      label: "Overdue AR",
      value: formatCurrency(health.overdueAr),
      helper: "Canonical overdue receivables",
    },
    {
      label: "Collections Rate",
      value: `${health.collectionsRate.toFixed(1)}%`,
      helper: "Canonical collection performance",
    },
  ];
}

export function buildLegacyWindowParams(
  dateRange: DateRangeParam,
  from?: string,
  to?: string,
): string {
  const params = new URLSearchParams();

  params.set("dateRange", dateRange);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  return params.toString();
}
