import { AlertTriangle, Banknote, CreditCard, Percent, Wallet } from "lucide-react";

import type { ExecutiveHealthBand as ExecutiveHealthBandData } from "@/lib/types/executive-bi";

import { formatExecutiveCurrency } from "@/components/executive-bi/ui";

const HEALTH_ITEMS = [
  {
    key: "revenue",
    label: "Revenue",
    helper: "QuickBooks revenue in the active window",
    icon: Banknote,
    formatter: (value: number) => formatExecutiveCurrency(value),
  },
  {
    key: "cashOnHand",
    label: "Cash On Hand",
    helper: "Liquidity buffer available now",
    icon: Wallet,
    formatter: (value: number) => formatExecutiveCurrency(value),
  },
  {
    key: "openAr",
    label: "Open AR",
    helper: "Total open receivables",
    icon: CreditCard,
    formatter: (value: number) => formatExecutiveCurrency(value),
  },
  {
    key: "overdueAr",
    label: "Overdue AR",
    helper: "Receivables already past due",
    icon: AlertTriangle,
    formatter: (value: number) => formatExecutiveCurrency(value),
  },
  {
    key: "collectionsRate",
    label: "Collections Rate",
    helper: "Collected versus invoiced",
    icon: Percent,
    formatter: (value: number) => `${value.toFixed(1)}%`,
  },
] as const;

export function ExecutiveHealthBand({
  health,
}: {
  health: ExecutiveHealthBandData;
}) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      {HEALTH_ITEMS.map((item) => {
        const Icon = item.icon;
        const value = health[item.key];
        return (
          <article
            key={item.key}
            className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
                  {item.label}
                </div>
                <p className="mt-3 font-display text-[1.85rem] font-bold leading-none text-brand-verde">
                  {item.formatter(value)}
                </p>
              </div>
              <div className="rounded-2xl bg-brand-verde/8 p-2.5 text-brand-verde">
                <Icon className="h-4.5 w-4.5" />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-gray-500">{item.helper}</p>
          </article>
        );
      })}
    </section>
  );
}

export default ExecutiveHealthBand;
