// lib/services/cfo-analysis.ts
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { integrationLogger } from "@/lib/utils/logger";
import { buildQbCfoReportNarrative, QbCfoReportPacket } from "@/lib/financial/qb-cfo-report-packet";
import { getCfoModelCandidates, modelSupportsJsonResponseFormat } from "@/lib/services/cfo-models";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = process.env.AI_MODEL;

export interface CfoAnalysisInput {
  revenue: number;
  revenueChangePct: number;
  collectionRate: number;
  prevCollectionRate: number;
  outstandingAR: number;
  mrr: number;
  topThreeConcentration: number;
  topThreeClients: Array<{ name: string; percentage: number }>;
  overdueCount: number;
  overdueTotal: number;
  worstOverdue: { customer: string; amount: number; days: number } | null;
  aging90Plus: number;
  cashProjection30Day: number;
  patternAlerts: string[];
  // Expense data (from QB reports, may be 0 if not loaded)
  totalExpenses: number;
  netIncome: number;
  marginPct: number;
  burnRate: number;
  cashOnHand: number;
  runwayMonths: number;
  topExpenseCategory: string;
  topExpenseAmount: number;
  dateRangeLabel: string;
  qbReportPacket?: QbCfoReportPacket;
}

interface AiCfoResponse {
  briefing: string;
  financialHealth: string;
  revenueAnalysis: string;
  cashFlowAnalysis: string;
  riskAssessment: string;
  strategicRecommendations: string[];
  immediateActions: string[];
  kpiTargets: string[];
}

function parseAiCfoResponse(content: string): { briefing: string; recommendations: string[] } {
  const parsed = JSON.parse(content || "{}");

  // Build the full analysis from structured sections
  const sections: string[] = [];

  if (parsed.briefing) sections.push(parsed.briefing);

  if (parsed.financialHealth) {
    sections.push(`\n**Financial Health Assessment**\n${parsed.financialHealth}`);
  }
  if (parsed.revenueAnalysis) {
    sections.push(`\n**Revenue & Collections Analysis**\n${parsed.revenueAnalysis}`);
  }
  if (parsed.cashFlowAnalysis) {
    sections.push(`\n**Cash Flow & Runway**\n${parsed.cashFlowAnalysis}`);
  }
  if (parsed.riskAssessment) {
    sections.push(`\n**Risk Assessment**\n${parsed.riskAssessment}`);
  }

  const briefing = sections.join("\n") || "Analysis unavailable.";

  // Combine strategic recommendations, immediate actions, and KPI targets
  const recommendations: string[] = [];

  if (Array.isArray(parsed.immediateActions) && parsed.immediateActions.length > 0) {
    recommendations.push("**Immediate Actions (This Week)**");
    parsed.immediateActions.forEach((a: string) => recommendations.push(a));
  }

  if (Array.isArray(parsed.strategicRecommendations) && parsed.strategicRecommendations.length > 0) {
    recommendations.push("**Strategic Recommendations (This Month)**");
    parsed.strategicRecommendations.forEach((r: string) => recommendations.push(r));
  }

  if (Array.isArray(parsed.kpiTargets) && parsed.kpiTargets.length > 0) {
    recommendations.push("**KPI Targets to Track**");
    parsed.kpiTargets.forEach((k: string) => recommendations.push(k));
  }

  // Fallback for old-format responses
  if (recommendations.length === 0 && Array.isArray(parsed.recommendations)) {
    parsed.recommendations.forEach((r: string) => recommendations.push(r));
  }

  return { briefing, recommendations };
}

const SYSTEM_PROMPT = `You are a Fractional CFO retained by Carreira U.S.A., an immigration services and career mentorship company based in the US. You serve Brazilian professionals seeking US careers through two programs: PASS (basic mentorship) and ADVANCED (full service).

Your role is to act as a REAL fractional CFO — not a data summarizer. You think strategically about the business, understand the immigration services market, and give the CEO guidance they can act on TODAY.

## Company Context
- Revenue comes from mentorship program enrollments (PASS and ADVANCED packages)
- Students go through an 11-phase journey from enrollment to job placement
- 3-person support team manages student lifecycle
- Main expenses: team salaries, software/SaaS tools, marketing
- QuickBooks is the source of truth for all financial data
- Goal: grow revenue while maintaining healthy margins and reducing customer concentration

## Your Analysis Framework
Think through these lenses like a real CFO would:

1. **Financial Health** — Is the business fundamentally healthy? Compare revenue vs expenses, track margin trends, assess if the business model is sustainable at current scale.

2. **Revenue Quality** — Is revenue growing? Is it diversified or concentrated? Are customers paying on time? Is MRR stable or volatile? What's the revenue per student trend?

3. **Cash Management** — Can the company meet its obligations? What's the real cash position? How many months of runway exist? Is cash being consumed faster than generated?

4. **Risk Exposure** — What could hurt the business in the next 30/60/90 days? Overdue invoices, customer concentration, expense growth outpacing revenue, stale receivables that may need write-off.

5. **Growth Levers** — Where can the CEO invest to grow? Which services are most profitable? Which customers could be upsold? What operational efficiencies would improve margins?

## Output Format (STRICT JSON)
Respond with this exact JSON structure:
{
  "briefing": "2-3 sentence executive summary — the single most important thing the CEO needs to know right now",
  "financialHealth": "3-5 sentences assessing overall financial health with specific numbers. Grade it: STRONG / STABLE / CONCERNING / CRITICAL",
  "revenueAnalysis": "3-5 sentences on revenue trends, collection performance, customer concentration. Name specific customers and amounts.",
  "cashFlowAnalysis": "3-5 sentences on cash position, burn rate, runway. Be specific about months of runway and what drives cash consumption.",
  "riskAssessment": "3-5 sentences on the top 2-3 risks with dollar impact. Name the customers, invoices, or expense categories that pose risk.",
  "strategicRecommendations": ["3-5 strategic recommendations for this month — each must reference specific numbers, customers, or categories"],
  "immediateActions": ["2-3 things the CEO should do THIS WEEK — be extremely specific with names, amounts, actions"],
  "kpiTargets": ["3-4 measurable targets to track — e.g., 'Bring collection rate from X% to Y% by [date]', 'Reduce 90+ AR from $X to $Y'"]
}

## Rules
- NEVER give generic advice. Every sentence must reference specific data points.
- Name real customers, real dollar amounts, real percentages.
- Think like a CFO who knows this business — not a data analyst reading numbers.
- If something is alarming, say it directly. Don't soften bad news.
- Prioritize: what moves the needle most for this specific company?
- Compare to industry benchmarks where relevant (services businesses typically target 15-25% net margin, 90%+ collection rate, <30 DSO).`;

export async function generateCfoAnalysis(input: CfoAnalysisInput): Promise<{ briefing: string; recommendations: string[] }> {
  const top3Text = input.topThreeClients
    .map((c) => `${c.name} (${c.percentage.toFixed(0)}%)`)
    .join(", ");

  const userPrompt = `Financial data for ${input.dateRangeLabel}:
- Revenue: $${input.revenue.toLocaleString()} (${input.revenueChangePct >= 0 ? "+" : ""}${input.revenueChangePct.toFixed(1)}% vs prior period)
- Collection rate: ${input.collectionRate.toFixed(1)}% (was ${input.prevCollectionRate.toFixed(1)}%)
- Outstanding AR: $${input.outstandingAR.toLocaleString()}
- MRR: $${input.mrr.toLocaleString()}
- Top 3 client concentration: ${input.topThreeConcentration.toFixed(0)}% (${top3Text})
- Overdue invoices: ${input.overdueCount} totaling $${input.overdueTotal.toLocaleString()}
${input.worstOverdue ? `- Worst overdue: ${input.worstOverdue.customer} — $${input.worstOverdue.amount.toLocaleString()}, ${input.worstOverdue.days} days` : "- No severely overdue invoices"}
- AR aging 90+ days: $${input.aging90Plus.toLocaleString()}
- Cash flow 30-day projection: $${input.cashProjection30Day.toLocaleString()}
${input.patternAlerts.length > 0 ? `- Payment pattern alerts: ${input.patternAlerts.join("; ")}` : "- No payment pattern alerts"}
${input.totalExpenses > 0 ? `- Total Expenses: $${input.totalExpenses.toLocaleString()}
- Net Income: $${input.netIncome.toLocaleString()} (margin: ${input.marginPct.toFixed(1)}%)
- Burn Rate: $${input.burnRate.toLocaleString()}/month
- Cash on Hand: $${input.cashOnHand.toLocaleString()} (runway: ${input.runwayMonths.toFixed(1)} months)
- Top expense: ${input.topExpenseCategory} at $${input.topExpenseAmount.toLocaleString()}` : "- Expense data: not available from QuickBooks"}
${input.qbReportPacket ? `\n${buildQbCfoReportNarrative(input.qbReportPacket)}` : "\nQuickBooks report packet: not available"}

Write the briefing and recommendations as JSON.`;

  try {
    let lastError: unknown;

    for (const model of getCfoModelCandidates(AI_MODEL)) {
      try {
        const completion = await openai.chat.completions.create({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 2000,
          ...(modelSupportsJsonResponseFormat(model)
            ? { response_format: { type: "json_object" as const } }
            : {}),
        });

        const content = completion.choices[0]?.message?.content || "{}";
        const parsed = parseAiCfoResponse(content);

        return {
          briefing: parsed.briefing || "Analysis unavailable.",
          recommendations: parsed.recommendations || [],
        };
      } catch (error: any) {
        lastError = error;
        const isAccessIssue = error?.status === 403 || error?.code === "model_not_found";
        if (!isAccessIssue) {
          throw error;
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error("No accessible CFO model available");
  } catch (error) {
    integrationLogger.logError("CFO_ANALYSIS", "generate", error instanceof Error ? error : String(error));
    return {
      briefing: "AI analysis temporarily unavailable. Rule-based insights are shown below.",
      recommendations: [],
    };
  }
}

export async function generateAndCacheCfoInsight(dateRange: string): Promise<void> {
  // This function is called by the cron job.
  // It queries financial data, generates AI analysis, and caches the result.
  const { getFinancialKPIs } = await import("@/lib/services/financial-bi");

  const kpis = await getFinancialKPIs(dateRange);

  const result = await generateCfoAnalysis(kpis);

  // Delete old insights for this date range, keep last 30
  await prisma.cfoInsight.deleteMany({
    where: {
      dateRange,
      createdAt: {
        lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      },
    },
  });

  await prisma.cfoInsight.create({
    data: {
      briefing: result.briefing,
      recommendations: JSON.stringify(result.recommendations),
      dataSnapshot: JSON.stringify(kpis),
      dateRange,
    },
  });
}

export async function getCachedCfoInsight(dateRange: string): Promise<{ briefing: string; recommendations: string[]; generatedAt: string } | null> {
  const insight = await prisma.cfoInsight.findFirst({
    where: { dateRange },
    orderBy: { generatedAt: "desc" },
  });

  if (!insight) return null;

  return {
    briefing: insight.briefing,
    recommendations: JSON.parse(insight.recommendations),
    generatedAt: insight.generatedAt.toISOString(),
  };
}
