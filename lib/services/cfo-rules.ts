// lib/services/cfo-rules.ts
import { Engine, RuleProperties } from "json-rules-engine";
import { CfoAction } from "@/lib/types/financial-bi";

// Facts interface — what the engine evaluates
export interface CfoFacts {
  collectionRate: number;
  prevCollectionRate: number;
  collectionRateChange: number;
  outstandingAR: number;
  topThreeConcentration: number;
  topThreeClients: Array<{ name: string; percentage: number }>;
  overdueInvoices: Array<{
    id: string;
    customerName: string;
    amount: number;
    daysOverdue: number;
    remindersSent: number;
    autoChargeStatus: string | null;
  }>;
  customerPaymentTrends: Array<{
    customerName: string;
    customerId: string;
    currentAvgDays: number;
    previousAvgDays: number;
    consecutiveSlowing: number;
  }>;
  thirtyDayCashProjection: number;
  aging90PlusAmount: number;
  prevAging90PlusAmount: number;
  // Expense fields (from QB reports, may be 0 if not loaded)
  expenseGrowthPct: number;
  revenueGrowthPct: number;
  netMarginPct: number;
  prevNetMarginPct: number;
  cashRunwayMonths: number;
  burnRate: number;
  prevBurnRate: number;
}

const rules: RuleProperties[] = [
  {
    name: "collection-rate-drop",
    priority: 10,
    conditions: {
      all: [
        { fact: "collectionRateChange", operator: "lessThan", value: -3 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "collection-rate-drop" },
    },
  },
  {
    name: "revenue-concentration-high",
    priority: 5,
    conditions: {
      all: [
        { fact: "topThreeConcentration", operator: "greaterThan", value: 40 },
      ],
    },
    event: {
      type: "INSIGHT",
      params: { rule: "revenue-concentration-high" },
    },
  },
  {
    name: "cash-position-tight",
    priority: 10,
    conditions: {
      all: [
        { fact: "thirtyDayCashProjection", operator: "lessThan", value: 0 },
      ],
    },
    event: {
      type: "URGENT",
      params: { rule: "cash-position-tight" },
    },
  },
  {
    name: "aging-90-plus-growing",
    priority: 6,
    conditions: {
      all: [
        { fact: "aging90PlusAmount", operator: "greaterThan", value: 0 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "aging-90-plus-growing" },
    },
  },
  {
    name: "expense-outpacing-revenue",
    priority: 7,
    conditions: {
      all: [
        { fact: "expenseGrowthPct", operator: "greaterThan", value: 0 },
        { fact: "revenueGrowthPct", operator: "greaterThanInclusive", value: 0 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "expense-outpacing-revenue" },
    },
  },
  {
    name: "margin-compression",
    priority: 8,
    conditions: {
      all: [
        { fact: "netMarginPct", operator: "lessThan", value: 100 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "margin-compression" },
    },
  },
  {
    name: "low-runway",
    priority: 10,
    conditions: {
      all: [
        { fact: "cashRunwayMonths", operator: "lessThan", value: 3 },
        { fact: "cashRunwayMonths", operator: "greaterThan", value: 0 },
      ],
    },
    event: {
      type: "URGENT",
      params: { rule: "low-runway" },
    },
  },
  {
    name: "burn-rate-spike",
    priority: 7,
    conditions: {
      all: [
        { fact: "burnRate", operator: "greaterThan", value: 0 },
        { fact: "prevBurnRate", operator: "greaterThan", value: 0 },
      ],
    },
    event: {
      type: "WATCH",
      params: { rule: "burn-rate-spike" },
    },
  },
];

function buildInvoiceActions(facts: CfoFacts): CfoAction[] {
  const actions: CfoAction[] = [];

  for (const inv of facts.overdueInvoices) {
    if (inv.daysOverdue > 45) {
      actions.push({
        severity: "URGENT",
        title: `Escalate ${inv.customerName}`,
        description: `$${inv.amount.toLocaleString()} outstanding, ${inv.daysOverdue} days overdue. ${inv.remindersSent} reminders sent.${inv.autoChargeStatus === "FAILED" ? " Auto-charge failed — card declined." : ""}`,
        linkedEntity: { type: "invoice", id: inv.id },
      });
    }

    if (inv.amount >= 5000 && inv.daysOverdue > 30 && inv.daysOverdue <= 45) {
      actions.push({
        severity: "URGENT",
        title: `High-value invoice at risk — ${inv.customerName}`,
        description: `$${inv.amount.toLocaleString()} invoice, ${inv.daysOverdue} days overdue. Needs immediate follow-up.`,
        linkedEntity: { type: "invoice", id: inv.id },
      });
    }
  }

  for (const trend of facts.customerPaymentTrends) {
    if (trend.consecutiveSlowing >= 3) {
      actions.push({
        severity: "WATCH",
        title: `${trend.customerName} payment pattern degrading`,
        description: `Average days-to-pay increased from ${trend.previousAvgDays} to ${trend.currentAvgDays} days over 3+ consecutive months.`,
        linkedEntity: { type: "customer", id: trend.customerId },
      });
    }
  }

  return actions;
}

function buildRuleActions(events: Array<{ type: string; params: { rule: string } }>, facts: CfoFacts): CfoAction[] {
  const actions: CfoAction[] = [];

  for (const event of events) {
    switch (event.params.rule) {
      case "collection-rate-drop":
        actions.push({
          severity: "WATCH",
          title: "Collection rate declining",
          description: `Collection rate dropped ${Math.abs(facts.collectionRateChange).toFixed(1)}% to ${facts.collectionRate.toFixed(1)}% (was ${facts.prevCollectionRate.toFixed(1)}%).`,
        });
        break;
      case "revenue-concentration-high": {
        const top3 = facts.topThreeClients.map((c) => `${c.name} (${c.percentage.toFixed(0)}%)`).join(", ");
        actions.push({
          severity: "INSIGHT",
          title: "Revenue concentration risk",
          description: `Top 3 clients represent ${facts.topThreeConcentration.toFixed(0)}% of revenue: ${top3}. Consider diversification strategies.`,
        });
        break;
      }
      case "cash-position-tight":
        actions.push({
          severity: "URGENT",
          title: "Cash shortfall projected",
          description: `30-day cash projection is negative ($${facts.thirtyDayCashProjection.toLocaleString()}). Accelerate collections on outstanding invoices.`,
        });
        break;
      case "aging-90-plus-growing": {
        const growth = facts.prevAging90PlusAmount > 0
          ? ((facts.aging90PlusAmount - facts.prevAging90PlusAmount) / facts.prevAging90PlusAmount * 100)
          : 100;
        if (growth > 10) {
          actions.push({
            severity: "WATCH",
            title: "Stale receivables growing",
            description: `AR 90+ days is $${facts.aging90PlusAmount.toLocaleString()}, up ${growth.toFixed(0)}% vs prior period. Review for potential write-offs.`,
          });
        }
        break;
      }
      case "expense-outpacing-revenue": {
        if (facts.expenseGrowthPct > facts.revenueGrowthPct) {
          actions.push({
            severity: "WATCH",
            title: "Expenses growing faster than revenue",
            description: `Expenses grew ${facts.expenseGrowthPct.toFixed(1)}% while revenue grew ${facts.revenueGrowthPct.toFixed(1)}%. Margin compression risk.`,
          });
        }
        break;
      }
      case "margin-compression": {
        const marginDrop = facts.prevNetMarginPct - facts.netMarginPct;
        if (marginDrop > 5) {
          actions.push({
            severity: "WATCH",
            title: "Net margin declining",
            description: `Net margin dropped from ${facts.prevNetMarginPct.toFixed(1)}% to ${facts.netMarginPct.toFixed(1)}% (${marginDrop.toFixed(1)} point decline).`,
          });
        }
        break;
      }
      case "low-runway":
        actions.push({
          severity: "URGENT",
          title: "Cash runway below 3 months",
          description: `At current burn rate ($${facts.burnRate.toLocaleString()}/mo), cash runway is ${facts.cashRunwayMonths.toFixed(1)} months. Immediate attention needed.`,
        });
        break;
      case "burn-rate-spike": {
        const burnIncrease = facts.prevBurnRate > 0 ? ((facts.burnRate - facts.prevBurnRate) / facts.prevBurnRate) * 100 : 0;
        if (burnIncrease > 20) {
          actions.push({
            severity: "WATCH",
            title: "Burn rate spike",
            description: `Monthly burn rate increased ${burnIncrease.toFixed(0)}% to $${facts.burnRate.toLocaleString()}/mo (was $${facts.prevBurnRate.toLocaleString()}/mo).`,
          });
        }
        break;
      }
    }
  }

  return actions;
}

export async function evaluateCfoRules(facts: CfoFacts): Promise<CfoAction[]> {
  const engine = new Engine();

  for (const rule of rules) {
    engine.addRule(rule);
  }

  const { events } = await engine.run(facts);

  const ruleActions = buildRuleActions(
    events as Array<{ type: string; params: { rule: string } }>,
    facts,
  );
  const invoiceActions = buildInvoiceActions(facts);

  // Combine and sort: URGENT first, then WATCH, then INSIGHT. Max 5.
  const allActions = [...ruleActions, ...invoiceActions];
  const severityOrder = { URGENT: 0, WATCH: 1, INSIGHT: 2 };
  allActions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return allActions.slice(0, 5);
}
