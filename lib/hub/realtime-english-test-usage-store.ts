import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  EMPTY_REALTIME_ENGLISH_USAGE_TOTALS,
  estimateRealtimeEnglishUsageCostUsd,
  hasRealtimeEnglishUsage,
  mergeRealtimeEnglishUsageTotals,
  normalizeRealtimeEnglishUsage,
  type RealtimeEnglishUsageTotals,
} from "@/lib/hub/realtime-english-test-usage";

function totalsFromRow(row: Partial<Record<keyof RealtimeEnglishUsageTotals, number | null>>): RealtimeEnglishUsageTotals {
  return {
    inputTextTokens: row.inputTextTokens ?? 0,
    cachedInputTextTokens: row.cachedInputTextTokens ?? 0,
    inputAudioTokens: row.inputAudioTokens ?? 0,
    outputTextTokens: row.outputTextTokens ?? 0,
    outputAudioTokens: row.outputAudioTokens ?? 0,
    totalTokens: row.totalTokens ?? 0,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function getExternalUsageEventId(value: unknown): string | null {
  const root = asRecord(value);
  const response = asRecord(root.response);
  const responseId = response.id;
  if (typeof responseId === "string" && responseId.trim()) {
    return `openai:${responseId.trim()}`;
  }

  const eventId = root.event_id || root.id;
  if (typeof eventId === "string" && eventId.trim()) {
    return `openai:${eventId.trim()}`;
  }

  return null;
}

export async function recordRealtimeEnglishUsage(input: {
  testId: string;
  customerId?: string;
  model?: string;
  source?: string;
  usage: unknown;
}): Promise<{ recorded: boolean }> {
  const incoming = normalizeRealtimeEnglishUsage(input.usage);
  if (!hasRealtimeEnglishUsage(incoming)) {
    return { recorded: false };
  }

  const externalEventId = getExternalUsageEventId(input.usage);
  if (externalEventId) {
    const existingEvent = await prisma.aiUsageEvent.findUnique({
      where: { externalEventId },
      select: { id: true },
    });
    if (existingEvent) {
      return { recorded: false };
    }
  }

  const existing = await prisma.englishRealtimeTest.findFirst({
    where: {
      id: input.testId,
      ...(input.customerId ? { customerId: input.customerId } : {}),
    },
    select: {
      id: true,
      usageInputTextTokens: true,
      usageCachedInputTextTokens: true,
      usageInputAudioTokens: true,
      usageOutputTextTokens: true,
      usageOutputAudioTokens: true,
      usageTotalTokens: true,
    },
  });

  if (!existing) {
    return { recorded: false };
  }

  const totals = mergeRealtimeEnglishUsageTotals(
    totalsFromRow({
      inputTextTokens: existing.usageInputTextTokens,
      cachedInputTextTokens: existing.usageCachedInputTextTokens,
      inputAudioTokens: existing.usageInputAudioTokens,
      outputTextTokens: existing.usageOutputTextTokens,
      outputAudioTokens: existing.usageOutputAudioTokens,
      totalTokens: existing.usageTotalTokens,
    }),
    incoming
  );

  const estimatedCostUsd = estimateRealtimeEnglishUsageCostUsd(totals);
  const eventCostUsd = estimateRealtimeEnglishUsageCostUsd(incoming);
  let createdUsageEvent = false;

  await prisma.$transaction(async (tx) => {
    if (externalEventId) {
      const duplicate = await tx.aiUsageEvent.findUnique({
        where: { externalEventId },
        select: { id: true },
      });
      if (duplicate) return;
    }

    await tx.aiUsageEvent.create({
      data: {
        source: input.source ?? "hub_realtime_english_test",
        provider: "openai",
        model: input.model ?? null,
        externalEventId,
        testId: existing.id,
        customerId: input.customerId ?? null,
        inputTextTokens: incoming.inputTextTokens,
        cachedInputTextTokens: incoming.cachedInputTextTokens,
        inputAudioTokens: incoming.inputAudioTokens,
        outputTextTokens: incoming.outputTextTokens,
        outputAudioTokens: incoming.outputAudioTokens,
        totalTokens: incoming.totalTokens,
        estimatedCostUsd: new Prisma.Decimal(eventCostUsd.toFixed(4)),
      },
    });
    createdUsageEvent = true;

    await tx.englishRealtimeTest.update({
      where: { id: existing.id },
      data: {
        usageInputTextTokens: totals.inputTextTokens,
        usageCachedInputTextTokens: totals.cachedInputTextTokens,
        usageInputAudioTokens: totals.inputAudioTokens,
        usageOutputTextTokens: totals.outputTextTokens,
        usageOutputAudioTokens: totals.outputAudioTokens,
        usageTotalTokens: totals.totalTokens,
        usageEstimatedCostUsd:
          estimatedCostUsd > 0 ? new Prisma.Decimal(estimatedCostUsd.toFixed(4)) : null,
        usageCapturedAt: new Date(),
      },
    });
  });

  return { recorded: createdUsageEvent };
}

export function emptyRealtimeEnglishUsageTotals(): RealtimeEnglishUsageTotals {
  return { ...EMPTY_REALTIME_ENGLISH_USAGE_TOTALS };
}
