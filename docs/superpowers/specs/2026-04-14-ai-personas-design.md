# AI Personas — Executive One-Click Analysis

## Summary

The hub-segmented AI already gives each area a focused chat. This design adds **one-click executive personas** on top of it — pre-configured "analyst" presets that answer the most common question of each hub in a fixed, scannable format. The free chat keeps working unchanged; personas are additive.

V1 ships one persona per hub, scoped strictly to that hub's domain, with a cache layer that protects token spend and a delta mode that makes repeat clicks cheap and useful.

## Goals

- Reduce friction for high-value recurring questions (daily brief, cash health, pipeline check, student-base status).
- Force consistent, executive-grade output (BLUF, numbers, delta, action) across all answers.
- Protect token spend through per-day organization-level caching.
- Keep free-form chat untouched.

## Non-Goals

- Execution-style assistants (writing emails, qualifying leads, drafting messages). Deferred to V2.
- Multiple personas per hub at launch. Architecture supports N personas per hub; V1 ships 1 per hub.
- Per-user personalization of persona output. Scope is per hub/role.
- Cross-hub aggregation via sub-calls. The admin persona reads raw tools directly, not other personas' outputs.
- Scheduled cache pre-warming at launch. Field is defined on the type, disabled in V1.

## User Experience

### Empty state vs active chat

Two presentations of the same persona, context-aware:

- **Empty state** (new conversation, zero messages): one large persona card occupies the center of the chat area. The card shows: icon, label, tagline, last-run freshness ("há 2h" or "nunca"), and a primary CTA button. Free-chat composer stays at the bottom.
- **Active chat** (at least one message): the persona collapses into a single chip rendered above the composer. Clicking the chip fires the preset; the result streams into the conversation like any assistant message.

Empty state is discoverable and invites the click. Active chat is discreet and respects the ongoing conversation.

### Message metadata

Persona responses render as normal assistant messages but carry extra metadata shown as a small badge row above the content:

- Persona name (e.g. "Raio-X Financeiro")
- Freshness: "Cache · 14:02" or "Live · agora"
- Action: "Atualizar" (forces cache bypass and re-runs)

### Delta mode

When the user fires a persona and a fresh cached result exists within TTL, the default behavior is **not** to replay the full analysis. Instead:

- Return the cached analysis **immediately** as a message, marked `Cache · HH:mm`.
- If the user fires the persona a second time after the cache was served, switch to **delta prompt**: the AI receives the cached analysis as prior context and is asked to produce only "what changed since the last run" — short, scannable, comparative.

Delta is per-user: "since the last time *I* saw this" is personal even when the underlying cached analysis is shared.

## Output Format — BLUF Contract

Every persona response, regardless of hub, follows this fixed section order:

```
TL;DR — one sentence, color-coded (🟢 good / 🟡 attention / 🔴 critical)
─────
Números — compact table of the key KPIs for the hub, with MoM or YoY comparison
─────
O que mudou — what changed since last run (populated only in delta mode or when cache exists)
─────
Ação recomendada — 1-2 imperative bullets
```

The `systemAppend` for every persona enforces this structure, plus: "always compare numbers with the equivalent prior period (MoM for weekly/monthly data, YoY for quarterly/annual)". Emoji use is restricted to the TL;DR line and the optional traffic-light marker on KPIs; no emoji salad.

## Personas (V1)

| Hub | Slug | Label | Tagline | Tool Whitelist (scope) |
|---|---|---|---|---|
| admin | `ceo-brief` | Briefing do Dia | Como estamos hoje, o que mudou, o que decidir | Union of financial + commercial + operational tools |
| financial | `raio-x-financeiro` | Raio-X Financeiro | Saúde financeira, caixa, inadimplência | QuickBooks P&L, Cash Flow, Aged Receivables, autopay queue |
| commercial | `pulso-pipeline` | Pulso do Pipeline | Pipeline saudável, funil, conversão, gargalos | Pipedrive deals, leads, conversion by source |
| operational | `status-da-base` | Status da Base | Base de alunos, fases críticas, SLAs, atenção | Student-phase queries, SLA checks, renewal pipeline |

Admin is the only persona with cross-hub tool access. Area personas are strictly domain-scoped — a `raio-x-financeiro` attempting to call `Pipedrive` is rejected at the tool-filter layer, not just discouraged by prompt.

## Architecture

### Type definition

New file: `lib/ai/personas.ts`.

```ts
export type PersonaDefinition = {
  slug: string;
  label: string;
  tagline: string;
  hub: AiHubSlug;
  icon: string;                   // lucide icon name
  systemAppend: string;           // includes BLUF contract + comparison rule + output structure
  toolWhitelist: readonly string[];
  defaultPrompt: string;          // what the user "typed" on first click
  deltaPrompt: string;            // used on repeat click when cache is served
  cacheTtlMinutes: number;        // default 180
  autoRefreshCron?: string;       // reserved for V1.5 — not read by V1 runtime
};

export const PERSONAS: readonly PersonaDefinition[];
export function getPersonasForHub(slug: AiHubSlug): PersonaDefinition[];
export function getPersonaBySlug(slug: string): PersonaDefinition | null;
```

### Chat API changes

`/api/dashboard/ai/chat/route.ts` accepts new optional body field: `personaSlug?: string`.

When `personaSlug` is present:

1. Look up the persona. If the user's role is not allowed for the persona's hub, return `403`.
2. Check cache: `(personaSlug, dayBucket)` where `dayBucket` is a string key representing the current TTL window. Computation: floor `Date.now()` to the start of a window of size `cacheTtlMinutes` relative to the UTC start of day, and format as `YYYY-MM-DD-HHmm`. Example with 180-min TTL: windows are `00:00`, `03:00`, `06:00`, …, `21:00` each day, so 14:37 UTC on 2026-04-14 → `2026-04-14-1200`.
3. **Cache hit** and this is the user's first read of this bucket: return the cached analysis as an assistant message tagged `fromCache: true`. Record `(personaSlug, userId, cacheHitAt)` in a lightweight read-log.
4. **Cache hit** and the user has already read this bucket: invoke the model with `deltaPrompt` plus the cached analysis as prior context. The delta response is **not** cached — deltas are per-user and ephemeral.
5. **Cache miss**: invoke the model with `defaultPrompt`, restrict tools to `toolWhitelist`, stream the response to the client, persist the completed text to cache under `(personaSlug, dayBucket)`.
6. User-initiated `refresh=true` bypasses the cache entirely and creates a new bucket entry.

### Cache storage

New Prisma model:

```prisma
model PersonaCacheEntry {
  id           String   @id @default(cuid())
  personaSlug  String
  dayBucket    String   // e.g. "2026-04-14-09" (TTL-aligned)
  content      String   @db.Text
  generatedAt  DateTime @default(now())
  generatedBy  String?  // userId of first requester
  @@unique([personaSlug, dayBucket])
  @@index([personaSlug, generatedAt])
}

model PersonaCacheRead {
  id            String   @id @default(cuid())
  personaSlug   String
  dayBucket     String
  userId        String
  readAt        DateTime @default(now())
  @@unique([personaSlug, dayBucket, userId])
  @@index([userId, readAt])
}
```

Cache entries are organization-wide (single tenant today). Read-log is per-user and drives delta routing.

### UI components

- **`components/ai/PersonaCard.tsx`** — large empty-state card. Takes `PersonaDefinition` plus `lastGeneratedAt?: Date`. Button dispatches persona preset.
- **`components/ai/PersonaChip.tsx`** — compact active-state chip. Same props, rendered in a horizontal row.
- **`components/ai/PersonaMessageMeta.tsx`** — metadata badge row for persona messages (name + freshness + refresh button).
- **`ChatPanel.tsx`** — conditional render: show `PersonaCard` when `messages.length === 0`, show `PersonaChip` row otherwise. No changes to `Suggestions` component (coexists; free-chat starter prompts remain).

### Tool whitelist enforcement

The chat route already passes tools to the AI SDK. When `personaSlug` is set, filter the tool list to `persona.toolWhitelist` before passing. Tools outside the whitelist are not exposed to the model for that call — enforcement is at the SDK boundary, not prompt-based.

## Data Flow

```
User clicks persona chip
  → ChatPanel.sendMessage({ personaSlug, hub })
  → POST /api/dashboard/ai/chat { messages, personaSlug, hub, refresh? }
  → Route: lookup persona → role check → cache lookup → branch:
      • hit + first-read   → return cached content as assistant message
      • hit + repeat-read  → model(deltaPrompt + cachedContent, filtered tools), stream
      • miss or refresh    → model(defaultPrompt, filtered tools), stream, persist to cache
  → Client renders result with PersonaMessageMeta badge
```

## Error Handling

- **Role not allowed for persona hub** → `403`, client shows a toast "Você não tem permissão para esta persona".
- **Persona slug unknown** → `400`.
- **Tool whitelist is empty or all required tools unavailable** → fall back to free model call without tools; persona output may degrade but still produces a readable answer.
- **Cache write fails after successful generation** → log and continue; user still receives the streamed answer.
- **Delta mode fails** (model error) → fall back to showing the cached content again, marked `Cache · HH:mm`.

## Testing

- **Unit**: `lib/ai/personas.ts` helpers (`getPersonasForHub`, `getPersonaBySlug`), cache key generation (dayBucket rounding).
- **Integration**: chat route with `personaSlug` across the 4 branches (hit-first, hit-repeat, miss, refresh). Role-check denial. Tool whitelist enforcement (assert non-whitelisted tool is not in the model's tool list).
- **E2E**: clicking a persona card on empty state renders a persona message with metadata badge; clicking a persona chip in active chat appends a persona message; second click within TTL shows a delta response; "Atualizar" produces a fresh non-cached response.
- **Manual smoke**: each of the 4 personas produces output that follows the BLUF contract (TL;DR / Números / O que mudou / Ação).

## Rollout

- Ship behind an env flag `AI_PERSONAS_ENABLED=true` for the first week.
- Instrument: count of persona clicks, cache-hit ratio, delta-mode triggers, refresh presses, token cost per persona per day.
- Review after 7 days. If cache-hit ratio is <30%, TTL is too tight or day bucket needs adjustment. If refresh presses outnumber natural expirations, TTL is too loose.

## Out of Scope (Deferred)

- **Execution personas** (writing emails, qualifying leads, drafting WhatsApp messages) — V2.
- **Multiple analyst angles per hub** (e.g. CFO + Controller in financial) — arch supports it, add by appending to `PERSONAS` array when a clear need emerges.
- **Auto-refresh cron** (pre-warming cache each morning) — type field present and unused in V1; implement in V1.5 if usage data shows morning clicks dominating.
- **Per-user persona preferences** (favorite format, preferred period) — not needed at launch.
- **Cross-hub aggregation by sub-call** (admin persona invoking financial persona's cached output) — evaluate only after V1 data shows admin's direct-tool approach is too token-heavy.

## Open Questions

None at spec time. All V1 decisions are locked:

- One persona per hub.
- Organization-wide cache, 3h default TTL, per-user read-log for delta routing.
- Admin has cross-hub tool access; area personas are strictly scoped.
- No execution personas in V1.
- BLUF output contract enforced via `systemAppend`.
