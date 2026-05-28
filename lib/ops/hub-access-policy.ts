export type HubAccessProgramType = "PASS" | "ADVANCED" | "EARLY_CAREER";

function normalizeProgramText(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function isHubAccessPausedForProgramType(programType: string | null | undefined): boolean {
  return programType === "PASS" || programType === "ADVANCED";
}

export function isHubAccessPausedForCheckout(input: {
  programSlug?: string | null;
  programName?: string | null;
}): boolean {
  const slug = normalizeProgramText(input.programSlug);
  const name = normalizeProgramText(input.programName);

  const slugMatches =
    slug === "pass" ||
    slug === "new-pass" ||
    slug === "pass-advanced" ||
    slug === "advanced" ||
    slug.includes("pass") ||
    slug.includes("advanced");

  const nameMatches =
    /\bpass\b/.test(name) ||
    /\badvanced\b/.test(name);

  return slugMatches || nameMatches;
}
