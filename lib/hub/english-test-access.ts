import { prisma } from "@/lib/db";
import type { Language } from "@/lib/i18n/hub";

export const WRITTEN_TEST_REQUIRED_CODE = "WRITTEN_TEST_REQUIRED";

export interface OralEnglishTestAccess {
  unlocked: boolean;
  code: typeof WRITTEN_TEST_REQUIRED_CODE | null;
  message: string | null;
  writtenTest: {
    id: string;
    cefrLevel: string;
    displayLevel: string;
    totalScore: number;
    percentage: number;
    createdAt: string;
  } | null;
}

export function writtenTestRequiredMessage(language: Language | string | null | undefined) {
  if (language === "pt-BR") {
    return "Complete o teste escrito de ingles antes de iniciar a entrevista oral.";
  }

  return "Complete the written English test before starting the oral interview.";
}

export async function getOralEnglishTestAccess(
  customerId: string,
  language: Language | string | null | undefined = "en"
): Promise<OralEnglishTestAccess> {
  const writtenTest = await prisma.placementTest.findFirst({
    where: {
      customerId,
      totalScore: { not: -1 },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      cefrLevel: true,
      displayLevel: true,
      totalScore: true,
      percentage: true,
      createdAt: true,
    },
  });

  if (!writtenTest) {
    return {
      unlocked: false,
      code: WRITTEN_TEST_REQUIRED_CODE,
      message: writtenTestRequiredMessage(language),
      writtenTest: null,
    };
  }

  return {
    unlocked: true,
    code: null,
    message: null,
    writtenTest: {
      ...writtenTest,
      createdAt: writtenTest.createdAt.toISOString(),
    },
  };
}
