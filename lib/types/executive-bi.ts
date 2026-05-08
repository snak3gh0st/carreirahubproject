export type ExecutiveAreaKey = "finance" | "sales" | "operations" | "ai";

export type ExecutiveFreshnessState = "fresh" | "stale" | "partial" | "unavailable";

export interface ExecutiveDecisionItem {
  id: string;
  area: ExecutiveAreaKey;
  severity: "high" | "medium" | "low";
  title: string;
  impact: string;
  suggestedAction: string;
  href: string;
}

export interface ExecutiveHealthBand {
  /** Revenue recognized/collected for the active reporting window. */
  revenue: number;
  /** Current available cash balance in the reporting currency. */
  cashOnHand: number;
  /** Total currently open accounts receivable. */
  openAr: number;
  /** Overdue accounts receivable as of the latest A/R snapshot. */
  overdueAr: number;
  /** Collections rate for the active reporting window. */
  collectionsRate: number;
}

export interface ExecutiveMetricItem {
  label: string;
  value: string;
  helper?: string;
}

export interface ExecutiveFreshness {
  state: ExecutiveFreshnessState;
  summary: string;
}

export interface ExecutiveOverview {
  briefing: string;
  health: ExecutiveHealthBand;
  decisionQueue: ExecutiveDecisionItem[];
  freshness: ExecutiveFreshness;
}

export interface ExecutiveAreaSummary {
  label: string;
  status: "good" | "watch" | "risk";
  summary: string;
  freshness: ExecutiveFreshness;
  signalCount?: number;
  metrics?: ExecutiveMetricItem[];
  href: string;
}

export interface ExecutiveAreaDrillDown {
  area: ExecutiveAreaKey;
  summary: string;
  bullets: string[];
}

export interface ExecutiveBIResponse {
  overview: ExecutiveOverview;
  areas: Record<ExecutiveAreaKey, ExecutiveAreaSummary>;
  areaDetails: Record<ExecutiveAreaKey, ExecutiveAreaDrillDown>;
}
