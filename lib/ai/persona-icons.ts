import { Sparkles, LineChart, Activity, Users, type LucideIcon } from "lucide-react";

// Static icon map — named imports let the bundler tree-shake unused icons.
// Dynamic `(icons as any)[name]` from a namespace import would pull the entire
// lucide-react barrel (~1000+ icons) into the client bundle.
//
// Keys are the kebab-case strings used in `PersonaDefinition.icon`. Lucide
// itself exports PascalCase only, so this map is also the kebab→PascalCase
// alias layer — previously the UI always fell back to Sparkles because
// `lucide["line-chart"]` was undefined.
const PERSONA_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "line-chart": LineChart,
  activity: Activity,
  users: Users,
};

export function resolveIcon(name: string): LucideIcon {
  return PERSONA_ICONS[name] ?? Sparkles;
}
