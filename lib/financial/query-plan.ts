import { TabParam } from "@/lib/types/financial-bi";

export type FinancialTabKey = Exclude<TabParam, "all">;

export function getFinancialQueryPlan(activeTab: FinancialTabKey): {
  summaryTab: "pnl";
  activeTabRequest: FinancialTabKey | null;
} {
  return {
    // The summary view needs KPI + P&L context, but not the heavy tab payloads.
    summaryTab: "pnl",
    activeTabRequest: activeTab === "pnl" ? null : activeTab,
  };
}
