export function getCfoModelCandidates(preferredModel?: string): string[] {
  const candidates = [preferredModel, "gpt-4", "gpt-3.5-turbo"].filter(Boolean) as string[];
  return Array.from(new Set(candidates));
}

export function modelSupportsJsonResponseFormat(model: string): boolean {
  return model.includes("turbo-preview") || model.includes("4.1") || model.includes("4o") || model.startsWith("gpt-5");
}
