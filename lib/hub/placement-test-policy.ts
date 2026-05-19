export const MAX_COMPLETED_PLACEMENT_TESTS = 2;

export function canStartPlacementTest(completedTestCount: number): {
  allowed: boolean;
  reason?: string;
} {
  if (completedTestCount < MAX_COMPLETED_PLACEMENT_TESTS) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason:
      "Voce pode refazer o teste de ingles apenas 1 vez. Fale com a equipe Carreira USA para liberar uma nova tentativa.",
  };
}
