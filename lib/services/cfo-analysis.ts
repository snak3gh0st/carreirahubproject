// lib/services/cfo-analysis.ts
import OpenAI from "openai";
import { prisma } from "@/lib/db";
import { integrationLogger } from "@/lib/utils/logger";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = process.env.AI_MODEL || "gpt-4-turbo-preview";

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
  dateRangeLabel: string;
}

interface AiCfoResponse {
  briefing: string;
  recommendations: string[];
}

const SYSTEM_PROMPT = `You are a Fractional CFO analyzing financial data for Carreira U.S.A., an immigration services and mentorship company based in the US. Write a concise executive briefing (3-5 sentences) and 2-3 strategic recommendations.

Rules:
- Be specific — reference actual customer names, dollar amounts, and percentages from the data provided
- Write for a CEO who has 30 seconds to read this
- Focus on what changed, what's at risk, and what to do about it
- Do NOT use generic advice — every recommendation must tie to the specific numbers
- Respond in valid JSON with keys "briefing" (string) and "recommendations" (array of strings)`;

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

Write the briefing and recommendations as JSON.`;

  try {
    const completion = await openai.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed: AiCfoResponse = JSON.parse(content);

    return {
      briefing: parsed.briefing || "Analysis unavailable.",
      recommendations: parsed.recommendations || [],
    };
  } catch (error) {
    integrationLogger.error("CFO_ANALYSIS", "generate", error);
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
