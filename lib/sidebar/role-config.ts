/**
 * Sidebar role config — single source of truth for which items each role sees.
 *
 * Phase 20 reorganization (D-01 + D-02 + D-03 + D-04 + D-08): extracts the
 * sidebar nav data from professional-sidebar.tsx into a pure data module keyed
 * by UserRole, with labeled hub-section headers.
 *
 * Hard rule (D-03): no cross-hub visibility for non-ADMIN roles. Each non-ADMIN
 * role sees EXACTLY ONE hub section. ADMIN is the only role with multiple
 * sections; ADMIN gets all four hub sections plus an "Admin" meta section.
 *
 * Cross-surface note (D-16): some hrefs (e.g., `/ops/*`) belong to a sibling
 * middleware-routed surface within the same Next.js app. They are NOT moved or
 * modified by Phase 20; the sidebar links to them via Next.js <Link>, and the
 * middleware re-evaluates role permission at navigation time. This is
 * documented here so future maintainers do not "fix" what looks like a layout
 * boundary violation.
 *
 * Naming convention (D-17): directory paths are English (e.g.,
 * `/dashboard/commercial/leads`); sidebar labels are Portuguese
 * (e.g., "Hub Comercial", "Leads").
 *
 * Wave coordination: the `/dashboard/commercial/leads` href is the post-move
 * URL from Plan 20-06 (Wave 3). End-of-Wave-2 builds have a dead sidebar link
 * to Leads by design — per D-18 the full Wave 3 must run before any prod
 * verification.
 */
import type { UserRole } from "@prisma/client";

export interface SidebarItem {
  href: string;
  /** Sidebar labels are Portuguese per D-17. */
  label: string;
  /** lucide-react export name, e.g. "LayoutDashboard". Component dereferences via icon map. */
  icon: string;
}

export interface SidebarSection {
  /** Hub label, e.g. "Hub Comercial" | "Hub Financeiro" | "Hub Operacional" | "Hub Executivo" | "Admin". */
  label: string;
  items: SidebarItem[];
}

/**
 * Hub-context derivation from URL prefix `/dashboard/{hub}/*`.
 *
 * NOT included:
 * - `operational` → uses `/ops/*` sibling-routed surface (Phase 20 D-16)
 * - `executive`   → already a self-contained hub from Phase 20-05; rendered via SIDEBAR_BY_ROLE.EXECUTIVE
 * - `null`        → caller is at a legacy `/dashboard/*` URL with no hub prefix
 */
export type HubContext = "commercial" | "financial" | "admin";

// Hub Comercial — items COMMERCIAL sees (HEAD_COMERCIAL inherits, adding BI Comercial)
// Per ROLE-04: Leads/Conversas/Negócios/Clientes/Faturas/Contratos.
// "Só HEAD" applies to BI Comercial ONLY (added in HUB_COMERCIAL_ITEMS_HEAD below).
const HUB_COMERCIAL_ITEMS_COMMERCIAL: SidebarItem[] = [
  { href: "/dashboard", label: "Início", icon: "LayoutDashboard" },
  // D-14: write the post-move URL directly. Plan 20-06 (Wave 3) creates the
  // physical file at this path + 308 redirect from /dashboard/leads.
  { href: "/dashboard/commercial/leads", label: "Leads", icon: "Users" },
  { href: "/dashboard/conversations", label: "Conversas", icon: "MessageSquare" },
  // ROLE-04: Negócios IS in Hub Comercial for COMMERCIAL too.
  { href: "/dashboard/deals", label: "Negócios", icon: "Briefcase" },
  // D-15: shared URL — server-side scoping in Plan 20-02 enforces row visibility.
  { href: "/dashboard/customers", label: "Clientes", icon: "Users" },
  // D-04: single Faturas entry per hub (no duplicates).
  { href: "/dashboard/invoices", label: "Faturas", icon: "FileText" },
  { href: "/dashboard/contracts", label: "Contratos", icon: "FileSignature" },
];

// HEAD_COMERCIAL gets the same items PLUS BI Comercial (ROLE-04 "só HEAD" parenthetical).
const HUB_COMERCIAL_ITEMS_HEAD: SidebarItem[] = [
  ...HUB_COMERCIAL_ITEMS_COMMERCIAL,
  { href: "/dashboard/commercial-bi", label: "BI Comercial", icon: "BarChart3" },
];

// Hub Financeiro — items FINANCE sees.
const HUB_FINANCEIRO_ITEMS: SidebarItem[] = [
  { href: "/dashboard/insights", label: "BI Financeiro", icon: "PieChart" },
  { href: "/dashboard/invoices", label: "Faturas", icon: "FileText" },
  { href: "/dashboard/payments", label: "Pagamentos", icon: "CreditCard" },
  { href: "/dashboard/contracts", label: "Contratos", icon: "FileSignature" },
  // D-15: shared URL — read-only / scoped behavior enforced by Plan 20-02.
  { href: "/dashboard/customers", label: "Clientes", icon: "Users" },
  { href: "/dashboard/deals", label: "Negócios", icon: "Briefcase" },
  { href: "/dashboard/integrations", label: "Hub de Integrações", icon: "Plug" },
];

// Hub Operacional — items OPERATIONAL sees (today invisible; fixed by ROLE-06).
// /ops/* hrefs are sibling middleware-routed surface (D-16) — Next.js <Link>
// will client-navigate and the middleware re-gates the destination.
const HUB_OPERACIONAL_ITEMS: SidebarItem[] = [
  { href: "/ops/enroll", label: "Matricular", icon: "GraduationCap" },
  { href: "/ops/pipeline", label: "Pipeline de Fases", icon: "Kanban" },
  { href: "/ops/daily", label: "Daily Action", icon: "ListChecks" },
  { href: "/dashboard/forms", label: "Formulários", icon: "ClipboardList" },
];

// Hub Executivo — items EXECUTIVE sees (D-05, D-06, D-08).
// Wave coordination: target page.tsx files for /dashboard/executive/* are
// delivered by Plan 20-05 in Wave 3 — end-of-Wave-2 builds expose dead links
// here by design, per D-18 single-atomic-PR rollout.
const HUB_EXECUTIVO_ITEMS: SidebarItem[] = [
  { href: "/dashboard/executive", label: "Briefing Executivo", icon: "Sparkles" },
  { href: "/dashboard/executive/commercial", label: "Resumo Comercial", icon: "BarChart3" },
  { href: "/dashboard/executive/financial", label: "Resumo Financeiro", icon: "PieChart" },
  { href: "/dashboard/executive/operational", label: "Resumo Operacional", icon: "GraduationCap" },
];

// Admin meta — items ONLY ADMIN sees (on top of all four hub sections).
// Rule 3 deviation: /dashboard/settings and /dashboard/debug have no top-level
// page.tsx in the repo today — only nested subroutes exist
// (settings/integrations, debug/qb-email-status). Point ADMIN at the existing
// deepest entry points so the sidebar links resolve to a real route.
const ADMIN_META_ITEMS: SidebarItem[] = [
  { href: "/dashboard/team", label: "Equipe", icon: "Users2" },
  { href: "/dashboard/settings/integrations", label: "Settings", icon: "Settings" },
  { href: "/dashboard/webhooks", label: "Webhooks", icon: "Webhook" },
  { href: "/dashboard/workflows", label: "Workflows", icon: "Workflow" },
  { href: "/dashboard/debug/qb-email-status", label: "Debug", icon: "Bug" },
];

/**
 * Per D-03 (hard rule): no cross-hub visibility for non-ADMIN roles.
 * Each non-ADMIN role sees EXACTLY ONE hub section.
 * ADMIN sees ALL four hub sections plus the Admin meta section.
 *
 * TypeScript enforces exhaustiveness over UserRole — adding a new role to the
 * Prisma enum without updating this map will fail `npx tsc --noEmit`.
 */
export const SIDEBAR_BY_ROLE: Readonly<Record<UserRole, SidebarSection[]>> = {
  COMMERCIAL: [
    { label: "Hub Comercial", items: HUB_COMERCIAL_ITEMS_COMMERCIAL },
  ],
  HEAD_COMERCIAL: [
    { label: "Hub Comercial", items: HUB_COMERCIAL_ITEMS_HEAD },
  ],
  FINANCE: [
    { label: "Hub Financeiro", items: HUB_FINANCEIRO_ITEMS },
  ],
  OPERATIONAL: [
    { label: "Hub Operacional", items: HUB_OPERACIONAL_ITEMS },
  ],
  HEAD_OPERACIONAL: [
    { label: "Hub Operacional", items: HUB_OPERACIONAL_ITEMS },
  ],
  EXECUTIVE: [
    { label: "Hub Executivo", items: HUB_EXECUTIVO_ITEMS },
  ],
  ADMIN: [
    // ADMIN gets the full HEAD-tier comercial (includes BI Comercial).
    { label: "Hub Comercial", items: HUB_COMERCIAL_ITEMS_HEAD },
    { label: "Hub Financeiro", items: HUB_FINANCEIRO_ITEMS },
    { label: "Hub Operacional", items: HUB_OPERACIONAL_ITEMS },
    { label: "Hub Executivo", items: HUB_EXECUTIVO_ITEMS },
    { label: "Admin", items: ADMIN_META_ITEMS },
  ],
} as const;

/**
 * Per-hub label lookup. Used by `getSidebarSectionsFor` to filter ADMIN's
 * multi-section stack down to the ONE section matching the current hub URL.
 *
 * `admin` maps to the "Admin" meta section by name, but `getSidebarSectionsFor`
 * special-cases ADMIN-at-`/dashboard/admin/*` to return the full consolidated
 * 5-section view (CONTEXT.md decision 3: "Hub Admin = ver tudo + configurar").
 */
const HUB_SECTION_LABEL: Readonly<Record<HubContext, string>> = {
  commercial: "Hub Comercial",
  financial: "Hub Financeiro",
  admin: "Admin",
} as const;

/**
 * Resolve sidebar sections for a given role + URL-derived hub context.
 *
 * Behavior:
 * - `hub === null` → legacy `/dashboard/*` URL: return current `SIDEBAR_BY_ROLE[role]` verbatim
 *   (ADMIN stacked, non-ADMIN single section). Guarantees zero regression for unprefixed URLs.
 * - `hub !== null` AND `role === "ADMIN"`:
 *   - `hub === "admin"` → consolidated view: return the full ADMIN section stack (4 hubs + Admin meta),
 *     matching CONTEXT.md decision 3 ("Hub Admin = ver tudo + configurar").
 *   - `hub === "commercial" | "financial"` → return ONLY the matching hub section.
 * - `hub !== null` AND `role !== "ADMIN"` → role already has exactly one section per D-03;
 *   return it regardless of hub mismatch (route gating is middleware's job, not the sidebar's).
 * - Unknown role → return `[]` (matches pre-existing fallback behavior).
 */
export function getSidebarSectionsFor(
  role: UserRole | string,
  hub: HubContext | null,
): SidebarSection[] {
  const sections = SIDEBAR_BY_ROLE[role as UserRole] ?? [];
  if (hub === null) return sections;

  if (role === "ADMIN") {
    if (hub === "admin") {
      // Hub Admin consolidated view: full SIDEBAR_BY_ROLE.ADMIN stack (4 hubs + Admin meta).
      return sections;
    }
    const label = HUB_SECTION_LABEL[hub];
    const match = sections.find((s) => s.label === label);
    return match ? [match] : sections;
  }

  return sections;
}
