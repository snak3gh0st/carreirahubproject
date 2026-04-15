# AI Personas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one-click executive personas per hub (`ceo-brief`, `raio-x-financeiro`, `pulso-pipeline`, `status-da-base`) on top of the existing hub-segmented AI chat, with BLUF-format output, organization-wide cache, per-user delta mode, and strict tool whitelists.

**Architecture:** Personas are **chat presets**, not separate agents. A new `lib/ai/personas.ts` registry defines each persona (systemAppend, toolWhitelist, defaultPrompt, deltaPrompt, cacheTtlMinutes). The existing `/api/dashboard/ai/chat` route learns to accept a `personaSlug` and branches: first-read serves cache, repeat-read runs delta prompt, cache-miss runs default prompt + persists. UI adds a large empty-state card and a compact chip above the composer; metadata badges annotate persona messages. Cache lives in two new Prisma tables (`PersonaCacheEntry` org-wide, `PersonaCacheRead` per-user).

**Tech Stack:** Next.js 14 App Router, AI SDK v6 (`@ai-sdk/react`, `ai`), Prisma + Postgres (Neon), `node:test` via `npx tsx --test`, Tailwind + lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-14-ai-personas-design.md`

**Test command:** `npx tsx --test tests/ai/<file>.test.ts`

**Feature flag:** `AI_PERSONAS_ENABLED=true` gates the entire feature. When unset or `false`, the chat route ignores `personaSlug` and the UI hides persona chips/cards.

---

## Task 1: Prisma schema — cache tables + AiMessage fields

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `.env.example`

- [ ] **Step 1: Add env flag to `.env.example`**

Append to the file:
```bash

# AI Personas — one-click executive analysis per hub
AI_PERSONAS_ENABLED=false
```

- [ ] **Step 2: Add Prisma models**

Add at the bottom of `prisma/schema.prisma`:

```prisma
model PersonaCacheEntry {
  id          String   @id @default(cuid())
  personaSlug String
  dayBucket   String
  content     String   @db.Text
  generatedAt DateTime @default(now())
  generatedBy String?

  @@unique([personaSlug, dayBucket])
  @@index([personaSlug, generatedAt])
}

model PersonaCacheRead {
  id          String   @id @default(cuid())
  personaSlug String
  dayBucket   String
  userId      String
  readAt      DateTime @default(now())

  @@unique([personaSlug, dayBucket, userId])
  @@index([userId, readAt])
}
```

- [ ] **Step 3: Add fields to `AiMessage` model**

Find `model AiMessage` in `prisma/schema.prisma` and add (inside the model, before the closing brace):

```prisma
  personaSlug String?
  fromCache   Boolean  @default(false)
```

- [ ] **Step 4: Generate client + push schema**

Run:
```bash
npm run db:generate && npm run db:push
```

Expected output: `Your database is now in sync with your Prisma schema.` No migration file — using `db:push` per CLAUDE.md dev convention.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma .env.example
git commit -m "feat(ai-personas): add PersonaCache tables and AiMessage persona fields"
```

---

## Task 2: Persona type + registry scaffolding

**Files:**
- Create: `lib/ai/personas.ts`
- Create: `tests/ai/personas.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/ai/personas.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import {
  PERSONAS,
  getPersonasForHub,
  getPersonaBySlug,
} from "../../lib/ai/personas.ts";

test("PERSONAS has exactly one entry per hub in V1", () => {
  const hubs = PERSONAS.map((p) => p.hub).sort();
  assert.deepEqual(hubs, ["admin", "commercial", "financial", "operational"]);
});

test("getPersonasForHub returns personas for that hub only", () => {
  const fin = getPersonasForHub("financial");
  assert.equal(fin.length, 1);
  assert.equal(fin[0].slug, "raio-x-financeiro");
});

test("getPersonasForHub returns empty array for unknown hub", () => {
  assert.deepEqual(getPersonasForHub("unknown" as any), []);
});

test("getPersonaBySlug finds known persona", () => {
  const p = getPersonaBySlug("ceo-brief");
  assert.ok(p);
  assert.equal(p?.hub, "admin");
});

test("getPersonaBySlug returns null for unknown slug", () => {
  assert.equal(getPersonaBySlug("nope"), null);
});

test("every persona has required fields", () => {
  for (const p of PERSONAS) {
    assert.ok(p.slug, `slug missing on persona`);
    assert.ok(p.label, `label missing on ${p.slug}`);
    assert.ok(p.tagline, `tagline missing on ${p.slug}`);
    assert.ok(p.icon, `icon missing on ${p.slug}`);
    assert.ok(p.systemAppend.length > 100, `systemAppend too short on ${p.slug}`);
    assert.ok(p.defaultPrompt, `defaultPrompt missing on ${p.slug}`);
    assert.ok(p.deltaPrompt, `deltaPrompt missing on ${p.slug}`);
    assert.ok(Array.isArray(p.toolWhitelist), `toolWhitelist not array on ${p.slug}`);
    assert.ok(p.cacheTtlMinutes > 0, `cacheTtlMinutes must be >0 on ${p.slug}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx --test tests/ai/personas.test.ts
```

Expected: FAIL with "Cannot find module '../../lib/ai/personas.ts'"

- [ ] **Step 3: Create the persona registry file**

Create `lib/ai/personas.ts`:

```ts
import type { AiHubSlug } from "./hub-config";

export type PersonaDefinition = Readonly<{
  slug: string;
  label: string;
  tagline: string;
  hub: AiHubSlug;
  icon: string;
  systemAppend: string;
  toolWhitelist: readonly string[];
  defaultPrompt: string;
  deltaPrompt: string;
  cacheTtlMinutes: number;
  autoRefreshCron?: string;
}>;

// Shared BLUF output contract appended to every persona's system prompt.
const BLUF_CONTRACT = `
Você é um analista sênior. Responda SEMPRE no formato abaixo, sem pular seções:

**TL;DR** — uma frase com status geral usando 🟢 (saudável), 🟡 (atenção) ou 🔴 (crítico).

**Números** — tabela compacta dos KPIs relevantes, cada número comparado com o período equivalente anterior (MoM para dados semanais/mensais, YoY para trimestrais/anuais). Se o dado de comparação não estiver disponível, escreva "n/d".

**O que mudou** — apenas quando houver um resultado anterior conhecido nesta conversa; caso contrário, omita esta seção.

**Ação recomendada** — 1 ou 2 bullets no imperativo, diretos e acionáveis.

Restrições:
- Use emoji apenas na linha TL;DR e nos marcadores 🟢🟡🔴 de KPIs críticos. Nunca espalhe emoji pelo texto.
- Seja conciso. Executivo. Evite advérbios de enchimento ("basicamente", "de fato").
- Nunca invente números: se uma tool não retornou o dado, escreva "n/d" e siga em frente.
`;

const CEO_BRIEF: PersonaDefinition = {
  slug: "ceo-brief",
  label: "Briefing do Dia",
  tagline: "Como estamos hoje, o que mudou, o que decidir",
  hub: "admin",
  icon: "sparkles",
  systemAppend:
    `Sua função é o Briefing Executivo do Dia para o CEO. Cubra finanças, pipeline comercial e operação de alunos em uma única leitura de 60 segundos. Priorize alertas e decisões pendentes sobre descrições neutras.\n${BLUF_CONTRACT}`,
  toolWhitelist: [
    "getQuickBooksReport",
    "getOverdueInvoices",
    "getPaymentsTimeline",
    "getInvoices",
    "getLeadsByStatus",
    "getLeadsBySource",
    "getLeadQualification",
    "getStudentsByPhase",
    "getCoordinatorOverview",
    "getDailyActionView",
    "getCurrentDate",
  ],
  defaultPrompt: "Gere o Briefing do Dia: saúde financeira, pulso do pipeline e status da base.",
  deltaPrompt:
    "Apenas liste o que mudou no negócio desde o último briefing exibido nesta conversa. Se nada relevante mudou, diga isso em uma linha.",
  cacheTtlMinutes: 180,
};

const RAIO_X_FINANCEIRO: PersonaDefinition = {
  slug: "raio-x-financeiro",
  label: "Raio-X Financeiro",
  tagline: "Saúde financeira, caixa, inadimplência",
  hub: "financial",
  icon: "line-chart",
  systemAppend:
    `Sua função é a revisão de controladoria do período. Cubra P&L do mês corrente, aging de recebíveis e faturas vencidas. Marque 🔴 qualquer risco imediato de caixa.\n${BLUF_CONTRACT}`,
  toolWhitelist: [
    "getQuickBooksReport",
    "getOverdueInvoices",
    "getPaymentsTimeline",
    "getInvoices",
    "getCurrentDate",
  ],
  defaultPrompt: "Gere o Raio-X Financeiro do período atual.",
  deltaPrompt:
    "Apenas liste o que mudou nos números financeiros desde o último raio-x exibido nesta conversa.",
  cacheTtlMinutes: 180,
};

const PULSO_PIPELINE: PersonaDefinition = {
  slug: "pulso-pipeline",
  label: "Pulso do Pipeline",
  tagline: "Pipeline saudável, funil, conversão, gargalos",
  hub: "commercial",
  icon: "activity",
  systemAppend:
    `Sua função é a revisão do gerente comercial. Cubra funil atual, conversão por origem e gargalos que travam novos fechamentos. Marque 🔴 gargalos que custam receita esta semana.\n${BLUF_CONTRACT}`,
  toolWhitelist: [
    "getLeadsByStatus",
    "getLeadsBySource",
    "getLeadQualification",
    "getCurrentDate",
  ],
  defaultPrompt: "Gere o Pulso do Pipeline do período atual.",
  deltaPrompt:
    "Apenas liste o que mudou no pipeline desde o último pulso exibido nesta conversa.",
  cacheTtlMinutes: 180,
};

const STATUS_DA_BASE: PersonaDefinition = {
  slug: "status-da-base",
  label: "Status da Base",
  tagline: "Base de alunos, fases críticas, SLAs, atenção",
  hub: "operational",
  icon: "users",
  systemAppend:
    `Sua função é a revisão da head of success. Cubra distribuição por fase, SLAs em risco e próximas renovações. Marque 🔴 alunos ou fases com risco de churn nos próximos 14 dias.\n${BLUF_CONTRACT}`,
  toolWhitelist: [
    "getStudentsByPhase",
    "getStudentNextActions",
    "getStudentSessions",
    "getCoordinatorOverview",
    "getDailyActionView",
    "getCurrentDate",
  ],
  defaultPrompt: "Gere o Status da Base do período atual.",
  deltaPrompt:
    "Apenas liste o que mudou na base de alunos desde o último status exibido nesta conversa.",
  cacheTtlMinutes: 180,
};

export const PERSONAS: readonly PersonaDefinition[] = [
  CEO_BRIEF,
  RAIO_X_FINANCEIRO,
  PULSO_PIPELINE,
  STATUS_DA_BASE,
];

const BY_SLUG = new Map(PERSONAS.map((p) => [p.slug, p]));

export function getPersonasForHub(hub: AiHubSlug): PersonaDefinition[] {
  return PERSONAS.filter((p) => p.hub === hub);
}

export function getPersonaBySlug(slug: string): PersonaDefinition | null {
  return BY_SLUG.get(slug) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx --test tests/ai/personas.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/personas.ts tests/ai/personas.test.ts
git commit -m "feat(ai-personas): add persona registry with 4 V1 personas"
```

---

## Task 3: Cache key helper (dayBucket)

**Files:**
- Create: `lib/ai/persona-cache.ts`
- Create: `tests/ai/persona-cache.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/ai/persona-cache.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { computeDayBucket } from "../../lib/ai/persona-cache.ts";

test("computeDayBucket floors to TTL window (180min)", () => {
  // 2026-04-14 14:37:00 UTC with 180min TTL → window starts at 12:00
  const date = new Date("2026-04-14T14:37:00.000Z");
  assert.equal(computeDayBucket(date, 180), "2026-04-14-1200");
});

test("computeDayBucket at exact window boundary picks that window", () => {
  const date = new Date("2026-04-14T15:00:00.000Z");
  assert.equal(computeDayBucket(date, 180), "2026-04-14-1500");
});

test("computeDayBucket at start of day uses 0000", () => {
  const date = new Date("2026-04-14T00:15:00.000Z");
  assert.equal(computeDayBucket(date, 180), "2026-04-14-0000");
});

test("computeDayBucket with 60min TTL produces hourly buckets", () => {
  const date = new Date("2026-04-14T09:45:00.000Z");
  assert.equal(computeDayBucket(date, 60), "2026-04-14-0900");
});

test("computeDayBucket pads hour correctly for single-digit hours", () => {
  const date = new Date("2026-04-14T03:10:00.000Z");
  assert.equal(computeDayBucket(date, 60), "2026-04-14-0300");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx --test tests/ai/persona-cache.test.ts
```

Expected: FAIL — module missing.

- [ ] **Step 3: Create the helper**

Create `lib/ai/persona-cache.ts`:

```ts
/**
 * Compute the dayBucket key for a persona cache entry.
 *
 * The bucket is a string `YYYY-MM-DD-HHmm` where HHmm is the start of the TTL
 * window containing `now`, aligned to UTC start of day.
 *
 * Example: with ttlMinutes = 180 (3h), windows are 00:00, 03:00, 06:00, … 21:00.
 * A request at 14:37 UTC falls into the 12:00 window → `YYYY-MM-DD-1200`.
 */
export function computeDayBucket(now: Date, ttlMinutes: number): string {
  if (ttlMinutes <= 0) throw new Error("ttlMinutes must be > 0");
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const minutesIntoDay = utcHour * 60 + utcMinute;
  const windowStartMinutes = Math.floor(minutesIntoDay / ttlMinutes) * ttlMinutes;
  const windowHour = Math.floor(windowStartMinutes / 60);
  const windowMinute = windowStartMinutes % 60;
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(windowHour).padStart(2, "0");
  const mi = String(windowMinute).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}${mi}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx --test tests/ai/persona-cache.test.ts
```

Expected: PASS — 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/persona-cache.ts tests/ai/persona-cache.test.ts
git commit -m "feat(ai-personas): add dayBucket cache key helper"
```

---

## Task 4: Cache read/write storage helpers

**Files:**
- Modify: `lib/ai/persona-cache.ts`
- Modify: `tests/ai/persona-cache.test.ts`

- [ ] **Step 1: Add storage helpers to the cache file**

Append to `lib/ai/persona-cache.ts`:

```ts
import { prisma } from "@/lib/db";
import type { PersonaCacheEntry } from "@prisma/client";

export type CacheLookup =
  | { status: "hit"; entry: PersonaCacheEntry; alreadyRead: boolean }
  | { status: "miss" };

/**
 * Look up a cache entry and detect whether this user already read it in this bucket.
 * `alreadyRead = true` signals the caller should use delta mode instead of re-serving.
 */
export async function lookupPersonaCache(params: {
  personaSlug: string;
  dayBucket: string;
  userId: string;
}): Promise<CacheLookup> {
  const entry = await prisma.personaCacheEntry.findUnique({
    where: {
      personaSlug_dayBucket: {
        personaSlug: params.personaSlug,
        dayBucket: params.dayBucket,
      },
    },
  });
  if (!entry) return { status: "miss" };

  const read = await prisma.personaCacheRead.findUnique({
    where: {
      personaSlug_dayBucket_userId: {
        personaSlug: params.personaSlug,
        dayBucket: params.dayBucket,
        userId: params.userId,
      },
    },
  });

  return { status: "hit", entry, alreadyRead: read !== null };
}

/** Record that this user has now read this bucket (idempotent). */
export async function recordPersonaCacheRead(params: {
  personaSlug: string;
  dayBucket: string;
  userId: string;
}): Promise<void> {
  await prisma.personaCacheRead.upsert({
    where: {
      personaSlug_dayBucket_userId: {
        personaSlug: params.personaSlug,
        dayBucket: params.dayBucket,
        userId: params.userId,
      },
    },
    create: { ...params },
    update: {}, // readAt stays at first-read time; we don't update on repeat hits.
  });
}

/** Persist a freshly-generated persona analysis into cache. */
export async function writePersonaCache(params: {
  personaSlug: string;
  dayBucket: string;
  content: string;
  generatedBy: string;
}): Promise<void> {
  await prisma.personaCacheEntry.upsert({
    where: {
      personaSlug_dayBucket: {
        personaSlug: params.personaSlug,
        dayBucket: params.dayBucket,
      },
    },
    create: {
      personaSlug: params.personaSlug,
      dayBucket: params.dayBucket,
      content: params.content,
      generatedBy: params.generatedBy,
    },
    update: {
      content: params.content,
      generatedAt: new Date(),
      generatedBy: params.generatedBy,
    },
  });
}
```

- [ ] **Step 2: Manual verification (no DB in unit tests)**

These storage helpers hit Prisma directly; running them in `node:test` would require a test DB. Skip unit tests here — Task 7's integration test covers the branches via the chat route. Instead, type-check:

```bash
npx tsc --noEmit lib/ai/persona-cache.ts
```

Expected: exits 0 with no output. If it fails, fix type errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add lib/ai/persona-cache.ts
git commit -m "feat(ai-personas): add cache read/write/record-read helpers"
```

---

## Task 5: Tool whitelist filter helper

**Files:**
- Modify: `lib/ai/tools/index.ts`
- Create: `tests/ai/persona-tool-filter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/ai/persona-tool-filter.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { filterToolsByWhitelist, toolRegistry } from "../../lib/ai/tools/index.ts";

test("filterToolsByWhitelist keeps only listed names", () => {
  const filtered = filterToolsByWhitelist(toolRegistry, ["getCurrentDate", "getInvoices"]);
  const names = filtered.map((t) => t.name).sort();
  assert.deepEqual(names, ["getCurrentDate", "getInvoices"]);
});

test("filterToolsByWhitelist ignores unknown whitelisted names without throwing", () => {
  const filtered = filterToolsByWhitelist(toolRegistry, ["getCurrentDate", "doesNotExist"]);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, "getCurrentDate");
});

test("filterToolsByWhitelist with empty whitelist returns empty array", () => {
  const filtered = filterToolsByWhitelist(toolRegistry, []);
  assert.equal(filtered.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx tsx --test tests/ai/persona-tool-filter.test.ts
```

Expected: FAIL — `filterToolsByWhitelist` not exported.

- [ ] **Step 3: Add the helper to `lib/ai/tools/index.ts`**

Append to the file (after `allowedToolsForRole`):

```ts
export function filterToolsByWhitelist(
  tools: AiToolDefinition<any, any>[],
  whitelist: readonly string[]
): AiToolDefinition<any, any>[] {
  const allow = new Set(whitelist);
  return tools.filter((t) => allow.has(t.name));
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx tsx --test tests/ai/persona-tool-filter.test.ts
```

Expected: PASS — 3 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/tools/index.ts tests/ai/persona-tool-filter.test.ts
git commit -m "feat(ai-personas): add tool whitelist filter helper"
```

---

## Task 6: Chat route — accept and validate personaSlug

**Files:**
- Modify: `app/api/dashboard/ai/chat/route.ts`

- [ ] **Step 1: Add parsing and validation for `personaSlug` + `refresh`**

In `app/api/dashboard/ai/chat/route.ts`, find the body parse block:

```ts
  let body: { messages: any[]; conversationId?: string; pathname?: string; params?: Record<string, any>; hub?: string };
```

Replace with:

```ts
  let body: {
    messages: any[];
    conversationId?: string;
    pathname?: string;
    params?: Record<string, any>;
    hub?: string;
    personaSlug?: string;
    refresh?: boolean;
  };
```

Then, immediately after the existing `hub`/`isRoleAllowedForHub` checks (after the line `const hubKey = getAiHubKeyBySlug(hub.slug);` and its null check), add:

```ts
  // Persona validation — only if flag is on and personaSlug is provided
  const personasEnabled = process.env.AI_PERSONAS_ENABLED === "true";
  const personaSlug = personasEnabled ? body.personaSlug : undefined;
  const refresh = personasEnabled ? Boolean(body.refresh) : false;
  let persona: import("@/lib/ai/personas").PersonaDefinition | null = null;
  if (personaSlug) {
    const { getPersonaBySlug } = await import("@/lib/ai/personas");
    persona = getPersonaBySlug(personaSlug);
    if (!persona) {
      return NextResponse.json({ error: "persona desconhecida" }, { status: 400 });
    }
    if (persona.hub !== hub.slug) {
      return NextResponse.json({ error: "persona não pertence a este hub" }, { status: 400 });
    }
  }
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit app/api/dashboard/ai/chat/route.ts
```

Expected: exits 0. If the file references types from elsewhere that fail, run `npx tsc --noEmit` from project root and verify no *new* errors in this file.

- [ ] **Step 3: Commit**

```bash
git add app/api/dashboard/ai/chat/route.ts
git commit -m "feat(ai-personas): accept personaSlug and refresh in chat route body"
```

---

## Task 7: Chat route — cache hit first-read branch

**Files:**
- Modify: `app/api/dashboard/ai/chat/route.ts`

- [ ] **Step 1: Add cache lookup + first-read serve**

In `app/api/dashboard/ai/chat/route.ts`, find the section right after `// 6. Persist USER message immediately` and its `prisma.aiMessage.create({...})` call. Immediately after that block, before `// 7. Build tool context + filtered tools`, add:

```ts
  // 6b. Persona cache branching
  let cachedForDelta: string | null = null;
  if (persona) {
    const { computeDayBucket, lookupPersonaCache, recordPersonaCacheRead } = await import(
      "@/lib/ai/persona-cache"
    );
    const dayBucket = computeDayBucket(new Date(), persona.cacheTtlMinutes);

    if (!refresh) {
      const lookup = await lookupPersonaCache({
        personaSlug: persona.slug,
        dayBucket,
        userId: user.id,
      });

      if (lookup.status === "hit" && !lookup.alreadyRead) {
        // First read → serve cached content as a normal assistant message, no model call.
        await recordPersonaCacheRead({
          personaSlug: persona.slug,
          dayBucket,
          userId: user.id,
        });
        const cached = lookup.entry.content;
        await prisma.aiMessage.create({
          data: {
            conversationId: conversation.id,
            role: AiMessageRole.ASSISTANT,
            content: cached,
            modelUsed: "cache",
            latencyMs: Date.now() - started,
            personaSlug: persona.slug,
            fromCache: true,
          },
        });
        await prisma.aiConversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });
        logAiEvent({
          kind: "finish",
          userId: user.id,
          conversationId: conversation.id,
          model: "cache",
          tokensIn: 0,
          tokensOut: 0,
          latencyMs: Date.now() - started,
        });
        return streamCachedResponse(cached);
      }

      if (lookup.status === "hit" && lookup.alreadyRead) {
        // Repeat read → feed cached content into delta prompt below.
        cachedForDelta = lookup.entry.content;
      }
    }
  }
```

- [ ] **Step 2: Add the `streamCachedResponse` helper**

At the top of the file, after imports (before `export const maxDuration`), add:

```ts
// Emit a cached string as a single-chunk AI SDK v6 UI message stream.
// Shape matches what `result.toUIMessageStreamResponse()` produces so the client
// renderer treats it identically to a live model response.
function streamCachedResponse(text: string): Response {
  const encoder = new TextEncoder();
  const id = `cache-${Date.now()}`;
  const events = [
    `data: ${JSON.stringify({ type: "start", messageId: id })}\n\n`,
    `data: ${JSON.stringify({ type: "text-start", id })}\n\n`,
    `data: ${JSON.stringify({ type: "text-delta", id, delta: text })}\n\n`,
    `data: ${JSON.stringify({ type: "text-end", id })}\n\n`,
    `data: ${JSON.stringify({ type: "finish" })}\n\n`,
    `data: [DONE]\n\n`,
  ];
  const stream = new ReadableStream({
    start(controller) {
      for (const e of events) controller.enqueue(encoder.encode(e));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "x-vercel-ai-ui-message-stream": "v1",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
```

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: exits 0, or no *new* errors introduced by this file. If the stream shape errors on the AI SDK version installed, verify event names by running a live stream in dev and mirroring its `data:` frames.

- [ ] **Step 4: Manual verification (dev server)**

```bash
AI_PERSONAS_ENABLED=true npm run dev
```

Seed a cache entry manually using Prisma Studio (`npm run db:studio`): create a `PersonaCacheEntry` with `personaSlug="raio-x-financeiro"`, `dayBucket` computed for today, and `content="TEST CACHED RAIO-X"`.

Then, as a user with FINANCE role, POST to `/api/dashboard/ai/chat` with `hub: "financial"`, `personaSlug: "raio-x-financeiro"`, and any message. Expected: response streams `TEST CACHED RAIO-X` once; a `PersonaCacheRead` row is created.

- [ ] **Step 5: Commit**

```bash
git add app/api/dashboard/ai/chat/route.ts
git commit -m "feat(ai-personas): serve cached persona content on first read"
```

---

## Task 8: Chat route — delta prompt branch (repeat read)

**Files:**
- Modify: `app/api/dashboard/ai/chat/route.ts`

- [ ] **Step 1: Wire persona into system prompt + messages when `cachedForDelta` or plain persona call**

In `app/api/dashboard/ai/chat/route.ts`, find the block that builds `systemPrompt`:

```ts
  const systemPrompt = buildSystemPrompt({ ... });
```

Immediately after it, add:

```ts
  // Persona: append persona-specific system rules. For delta mode, also prepend
  // the cached analysis as context the model must compare against.
  let effectiveSystemPrompt = systemPrompt;
  let effectiveUserPrompt: string | null = null;
  if (persona) {
    effectiveSystemPrompt = `${systemPrompt}\n\n---\n${persona.systemAppend}`;
    if (cachedForDelta) {
      effectiveSystemPrompt += `\n\n---\nANÁLISE ANTERIOR (cache da rodada em vigor, gerada mais cedo hoje):\n${cachedForDelta}`;
      effectiveUserPrompt = persona.deltaPrompt;
    } else {
      effectiveUserPrompt = persona.defaultPrompt;
    }
  }
```

- [ ] **Step 2: Replace the model messages when persona is active**

Find the block:

```ts
    const recentMessages = messages.slice(-20);
    const modelMessages = await convertToModelMessages(recentMessages);
```

Replace with:

```ts
    const recentMessages = messages.slice(-20);
    let modelMessages = await convertToModelMessages(recentMessages);
    if (persona && effectiveUserPrompt) {
      // Overwrite the last user turn with the persona's preset prompt so the user
      // can't override output format with accidental text in the composer.
      modelMessages = [
        ...modelMessages.slice(0, -1),
        { role: "user", content: effectiveUserPrompt } as any,
      ];
    }
```

- [ ] **Step 3: Replace `system: systemPrompt` with `effectiveSystemPrompt`**

Find the `streamText({` call. Change:

```ts
      system: systemPrompt,
```

to:

```ts
      system: effectiveSystemPrompt,
```

- [ ] **Step 4: Filter tools when persona is active**

Find the block that builds `aiSdkTools`:

```ts
  const allowed = allowedToolsForRole(user.role);
  const aiSdkTools: Record<string, ReturnType<typeof toAiSdkTool>> = {};
  for (const t of allowed) {
    aiSdkTools[t.name] = toAiSdkTool(t, ctx);
  }
```

Replace with:

```ts
  const allowed = allowedToolsForRole(user.role);
  const effectiveTools = persona
    ? (await import("@/lib/ai/tools")).filterToolsByWhitelist(allowed, persona.toolWhitelist)
    : allowed;
  const aiSdkTools: Record<string, ReturnType<typeof toAiSdkTool>> = {};
  for (const t of effectiveTools) {
    aiSdkTools[t.name] = toAiSdkTool(t, ctx);
  }
```

- [ ] **Step 5: Tag persisted assistant message with personaSlug (delta mode only — not cached)**

In the `onFinish` handler, find the final `prisma.aiMessage.create` that persists the `ASSISTANT` message. Change its `data:` object to include:

```ts
              personaSlug: persona?.slug ?? null,
              fromCache: false,
```

(Add these two fields alongside `tokensIn`, `tokensOut`, etc.)

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: exits 0, or no *new* errors introduced.

- [ ] **Step 7: Commit**

```bash
git add app/api/dashboard/ai/chat/route.ts
git commit -m "feat(ai-personas): inject persona system prompt and delta context"
```

---

## Task 9: Chat route — cache miss branch (persist generated content)

**Files:**
- Modify: `app/api/dashboard/ai/chat/route.ts`

- [ ] **Step 1: Persist generation to cache on miss (not on delta)**

In the `onFinish` handler in `app/api/dashboard/ai/chat/route.ts`, after the block that persists the `ASSISTANT` message (inside the `try` block, after the `prisma.aiConversation.update`), add:

```ts
          // Persona cache miss → persist this fresh generation for the current bucket.
          // Delta-mode responses (cachedForDelta set) are ephemeral and NOT cached.
          if (persona && !cachedForDelta) {
            const { computeDayBucket, writePersonaCache, recordPersonaCacheRead } = await import(
              "@/lib/ai/persona-cache"
            );
            const dayBucket = computeDayBucket(new Date(), persona.cacheTtlMinutes);
            await writePersonaCache({
              personaSlug: persona.slug,
              dayBucket,
              content: text ?? "",
              generatedBy: user.id,
            });
            await recordPersonaCacheRead({
              personaSlug: persona.slug,
              dayBucket,
              userId: user.id,
            });
          }
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: exits 0 or no new errors in this file.

- [ ] **Step 3: Manual verification (dev server)**

With `AI_PERSONAS_ENABLED=true`, call the chat route as FINANCE user with `personaSlug: "raio-x-financeiro"` and no existing cache for today's bucket. Expected: response streams from model; after finish, `PersonaCacheEntry` row exists with matching `dayBucket` and `content` equal to the streamed text; `PersonaCacheRead` row exists for that user.

Second call by the **same** user, same bucket: served from cache (Task 7 branch). Third call by the same user: delta branch (cached context, persona.deltaPrompt as last user message).

- [ ] **Step 4: Commit**

```bash
git add app/api/dashboard/ai/chat/route.ts
git commit -m "feat(ai-personas): persist generated persona analysis to cache on miss"
```

---

## Task 10: Chat route — `refresh=true` bypass

**Files:**
- Modify: `app/api/dashboard/ai/chat/route.ts`

- [ ] **Step 1: Verify `refresh` already bypasses lookup**

Task 6 already parsed `refresh` and Task 7 wraps cache lookup in `if (!refresh)`. The refresh path therefore skips lookup entirely, never sets `cachedForDelta`, and Task 9 writes a new cache entry — effectively replacing the current bucket's content via `upsert`.

No new code required. Confirm by reading `app/api/dashboard/ai/chat/route.ts` section `6b. Persona cache branching` — `if (!refresh)` must wrap the entire cache lookup block.

- [ ] **Step 2: Manual verification**

Call the chat route as a user who has already read today's bucket (delta branch would normally fire). Pass `refresh: true`. Expected: full model call, new `PersonaCacheEntry` with updated `generatedAt` (upsert replaces), `PersonaCacheRead` remains (upsert no-op on update).

- [ ] **Step 3: Commit (empty if no code changed)**

If any adjustments were needed to ensure the guard wraps correctly, commit them:

```bash
git add app/api/dashboard/ai/chat/route.ts
git commit -m "fix(ai-personas): ensure refresh=true bypasses cache lookup" || echo "nothing to commit"
```

---

## Task 11: PersonaCard component (empty state)

**Files:**
- Create: `components/ai/PersonaCard.tsx`

- [ ] **Step 1: Create the component**

Create `components/ai/PersonaCard.tsx`:

```tsx
"use client";
import * as icons from "lucide-react";
import type { PersonaDefinition } from "@/lib/ai/personas";

type LucideIconName = keyof typeof icons;

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  const Icon = (icons as any)[name] ?? icons.Sparkles;
  return Icon as any;
}

function formatFreshness(lastGeneratedAt?: Date | null): string {
  if (!lastGeneratedAt) return "nunca executado";
  const mins = Math.round((Date.now() - lastGeneratedAt.getTime()) / 60000);
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.round(hours / 24);
  return `há ${days}d`;
}

export function PersonaCard({
  persona,
  lastGeneratedAt,
  onRun,
  disabled,
}: {
  persona: PersonaDefinition;
  lastGeneratedAt?: Date | null;
  onRun: () => void;
  disabled?: boolean;
}) {
  const Icon = resolveIcon(persona.icon);
  return (
    <div className="mx-auto w-full max-w-[520px] rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_20px_60px_rgba(23,53,44,0.08)]">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl bg-primary/10 p-3 text-primary">
          <Icon className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-[#10251e]">{persona.label}</h3>
          <p className="mt-1 text-sm text-[#24342d]/80">{persona.tagline}</p>
          <p className="mt-3 text-xs text-muted-foreground">
            Última leitura: {formatFreshness(lastGeneratedAt ?? null)}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={disabled}
        className="mt-5 w-full rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-sm transition hover:brightness-105 disabled:opacity-50"
      >
        Rodar {persona.label.toLowerCase()}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit components/ai/PersonaCard.tsx
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/ai/PersonaCard.tsx
git commit -m "feat(ai-personas): add PersonaCard empty-state component"
```

---

## Task 12: PersonaChip component (active chat)

**Files:**
- Create: `components/ai/PersonaChip.tsx`

- [ ] **Step 1: Create the component**

Create `components/ai/PersonaChip.tsx`:

```tsx
"use client";
import * as icons from "lucide-react";
import type { PersonaDefinition } from "@/lib/ai/personas";

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  const Icon = (icons as any)[name] ?? icons.Sparkles;
  return Icon as any;
}

export function PersonaChip({
  persona,
  onRun,
  disabled,
}: {
  persona: PersonaDefinition;
  onRun: () => void;
  disabled?: boolean;
}) {
  const Icon = resolveIcon(persona.icon);
  return (
    <button
      type="button"
      onClick={onRun}
      disabled={disabled}
      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-xs font-medium text-[#10251e] shadow-sm transition hover:border-primary/40 hover:bg-primary/5 disabled:opacity-50"
      title={persona.tagline}
    >
      <Icon className="h-3.5 w-3.5 text-primary" />
      {persona.label}
    </button>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit components/ai/PersonaChip.tsx
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/ai/PersonaChip.tsx
git commit -m "feat(ai-personas): add PersonaChip active-state component"
```

---

## Task 13: PersonaMessageMeta component (badge row on persona messages)

**Files:**
- Create: `components/ai/PersonaMessageMeta.tsx`

- [ ] **Step 1: Create the component**

Create `components/ai/PersonaMessageMeta.tsx`:

```tsx
"use client";
import { RefreshCw } from "lucide-react";
import type { PersonaDefinition } from "@/lib/ai/personas";

export function PersonaMessageMeta({
  persona,
  fromCache,
  onRefresh,
  disabled,
}: {
  persona: PersonaDefinition;
  fromCache: boolean;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
        {persona.label}
      </span>
      <span>{fromCache ? "Cache" : "Live"}</span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={disabled}
        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 hover:bg-black/5 disabled:opacity-50"
        title="Rodar nova análise agora"
      >
        <RefreshCw className="h-3 w-3" /> Atualizar
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit components/ai/PersonaMessageMeta.tsx
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add components/ai/PersonaMessageMeta.tsx
git commit -m "feat(ai-personas): add PersonaMessageMeta badge row"
```

---

## Task 14: ChatPanel integration — dispatch persona presets

**Files:**
- Modify: `components/ai/ChatPanel.tsx`

- [ ] **Step 1: Import persona helpers and components**

In `components/ai/ChatPanel.tsx`, after the existing imports, add:

```tsx
import { getPersonasForHub, type PersonaDefinition } from "@/lib/ai/personas";
import { PersonaCard } from "./PersonaCard";
import { PersonaChip } from "./PersonaChip";
```

- [ ] **Step 2: Add the `handleRunPersona` dispatcher**

Inside the `ChatPanel` component, after `handleSend`, add:

```tsx
  const personasEnabled = process.env.NEXT_PUBLIC_AI_PERSONAS_ENABLED === "true";
  const personas: PersonaDefinition[] = personasEnabled ? getPersonasForHub(hub as any) : [];

  const handleRunPersona = async (persona: PersonaDefinition, refresh = false) => {
    const prompt = persona.defaultPrompt;
    const resolvedConversationId = await ensureConversationId(prompt);
    (sendMessage as any)(
      { text: prompt },
      {
        body: {
          ...extraBody,
          conversationId: resolvedConversationId,
          personaSlug: persona.slug,
          refresh,
        },
      }
    );
  };
```

- [ ] **Step 3: Render PersonaCard in empty state, PersonaChip row in active state**

Replace the existing render block (from `<ComplianceGate>` onward) with:

```tsx
  return (
    <ComplianceGate>
      <div className="flex flex-col h-full bg-background">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col justify-center gap-6 px-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold">Oi, {firstName}! Como posso ajudar?</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Pergunte sobre alunos, leads, faturas, contratos.
              </p>
            </div>
            {personas.length > 0 && (
              <div className="flex flex-col items-center gap-3">
                {personas.map((p) => (
                  <PersonaCard
                    key={p.slug}
                    persona={p}
                    onRun={() => void handleRunPersona(p)}
                    disabled={isStreaming}
                  />
                ))}
              </div>
            )}
            <Suggestions
              items={getSuggestionsForRole(role, hub)}
              onPick={(q) => void handleSend(q)}
            />
          </div>
        ) : (
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            onDeleteMessage={handleDeleteMessage}
          />
        )}
        {messages.length > 0 && personas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-black/5 px-4 py-2 md:px-8">
            {personas.map((p) => (
              <PersonaChip
                key={p.slug}
                persona={p}
                onRun={() => void handleRunPersona(p)}
                disabled={isStreaming}
              />
            ))}
          </div>
        )}
        <Composer onSend={handleSend} disabled={isStreaming} />
      </div>
    </ComplianceGate>
  );
```

- [ ] **Step 4: Expose the public env var to the client**

Add to `.env.example` (after the `AI_PERSONAS_ENABLED=false` line from Task 1):

```bash
# Mirror of AI_PERSONAS_ENABLED exposed to the browser (must match server value)
NEXT_PUBLIC_AI_PERSONAS_ENABLED=false
```

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: exits 0 or no new errors in `ChatPanel.tsx`.

- [ ] **Step 6: Manual smoke in dev**

```bash
AI_PERSONAS_ENABLED=true NEXT_PUBLIC_AI_PERSONAS_ENABLED=true npm run dev
```

Open `/dashboard/financial/ai` as a FINANCE user. Expected: empty state shows a PersonaCard for "Raio-X Financeiro". Click it → message appears with the persona preset prompt, assistant streams an analysis in BLUF format. After the response, a chip row appears above the composer.

Open `/dashboard/admin/ai` as an ADMIN user. Expected: PersonaCard for "Briefing do Dia". Clicking runs the cross-hub briefing.

- [ ] **Step 7: Commit**

```bash
git add components/ai/ChatPanel.tsx .env.example
git commit -m "feat(ai-personas): render persona card/chip in ChatPanel and dispatch presets"
```

---

## Task 15: MessageList — attach persona metadata badge

**Files:**
- Modify: `app/api/dashboard/ai/conversations/[id]/route.ts`
- Modify: `components/ai/ChatPanel.tsx`
- Modify: `components/ai/MessageList.tsx`
- Modify: `components/ai/MessageBubble.tsx`

- [ ] **Step 1: Return persona fields in conversation GET**

Open `app/api/dashboard/ai/conversations/[id]/route.ts`. Find the `prisma.aiMessage.findMany` call and ensure the select/return shape includes `personaSlug` and `fromCache`. If the handler uses the default select (all fields), nothing to change. Otherwise, add to the `select`:

```ts
      personaSlug: true,
      fromCache: true,
```

Verify by reading the current handler and confirming those fields reach the JSON response.

- [ ] **Step 2: Propagate persona fields into the UI message shape**

In `components/ai/ChatPanel.tsx`, find the `useEffect` that loads existing conversation messages. Change the `.map((m: any) => ({...}))` to:

```tsx
          .map((m: any) => ({
            id: m.id,
            role: m.role === 'USER' ? 'user' : 'assistant',
            parts: [{ type: 'text', text: m.content ?? '' }],
            personaSlug: m.personaSlug ?? undefined,
            fromCache: m.fromCache ?? false,
          }));
```

- [ ] **Step 3: Forward persona fields into MessageList → MessageBubble**

In `components/ai/MessageList.tsx`, find the existing `MessageBubble` call site:

```tsx
                  <MessageBubble
                    key={idx}
                    role={m.role === 'assistant' ? 'assistant' : 'user'}
                    content={p.text}
                    onDelete={onDeleteMessage ? () => onDeleteMessage(m.id) : undefined}
                  />
```

Replace with:

```tsx
                  <MessageBubble
                    key={idx}
                    role={m.role === 'assistant' ? 'assistant' : 'user'}
                    content={p.text}
                    personaSlug={m.personaSlug}
                    fromCache={m.fromCache}
                    onDelete={onDeleteMessage ? () => onDeleteMessage(m.id) : undefined}
                    onRefreshPersona={onRefreshPersona}
                  />
```

Then update the `MessageList` component prop typing by finding:

```tsx
export function MessageList({
  messages,
  isStreaming,
  onDeleteMessage,
}: {
```

Replace with:

```tsx
export function MessageList({
  messages,
  isStreaming,
  onDeleteMessage,
  onRefreshPersona,
}: {
  messages: any[];
  isStreaming: boolean;
  onDeleteMessage?: (messageId: string) => void;
  onRefreshPersona?: (personaSlug: string) => void;
}) {
```

- [ ] **Step 4: Render the metadata badge inside MessageBubble**

In `components/ai/MessageBubble.tsx`, update the component signature and add the badge. First, add the import at the top:

```tsx
import { PersonaMessageMeta } from "./PersonaMessageMeta";
import { getPersonaBySlug } from "@/lib/ai/personas";
```

Then change the function signature to accept the new props:

```tsx
export function MessageBubble({
  role,
  content,
  personaSlug,
  fromCache,
  onDelete,
  onRefreshPersona,
}: {
  role: 'user' | 'assistant';
  content: string;
  personaSlug?: string;
  fromCache?: boolean;
  onDelete?: () => void;
  onRefreshPersona?: (personaSlug: string) => void;
}) {
```

Then, inside the assistant branch (the `<div className="prose prose-sm ...">` block), immediately before the `<ReactMarkdown>` element, insert:

```tsx
            {personaSlug && (() => {
              const persona = getPersonaBySlug(personaSlug);
              if (!persona) return null;
              return (
                <PersonaMessageMeta
                  persona={persona}
                  fromCache={Boolean(fromCache)}
                  onRefresh={() => onRefreshPersona?.(persona.slug)}
                />
              );
            })()}
```

- [ ] **Step 5: Wire `onRefreshPersona` from ChatPanel to MessageList**

In `components/ai/ChatPanel.tsx`, find the `<MessageList ... />` usage. Change it to:

```tsx
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            onDeleteMessage={handleDeleteMessage}
            onRefreshPersona={(slug) => {
              const p = personas.find((x) => x.slug === slug);
              if (p) void handleRunPersona(p, true);
            }}
          />
```

- [ ] **Step 6: Type-check**

```bash
npx tsc --noEmit
```

Expected: exits 0 or no new errors in these files.

- [ ] **Step 7: Manual verification**

Restart the dev server. Click a persona from the empty state → response streams → refresh the page. Expected: on reload, the assistant message carries the persona badge ("Raio-X Financeiro · Cache/Live · Atualizar"). Click Atualizar → a new message appears with a freshly-generated (non-cached) response.

- [ ] **Step 8: Commit**

```bash
git add app/api/dashboard/ai/conversations/[id]/route.ts components/ai/ChatPanel.tsx components/ai/MessageList.tsx components/ai/MessageBubble.tsx
git commit -m "feat(ai-personas): render persona metadata badge with refresh on assistant messages"
```

---

## Task 16: E2E smoke test — manual verification checklist

**Files:** none (manual only)

- [ ] **Step 1: Start dev server with flags on**

```bash
AI_PERSONAS_ENABLED=true NEXT_PUBLIC_AI_PERSONAS_ENABLED=true npm run dev
```

- [ ] **Step 2: Walk through the happy path for each persona**

For each `(hub, persona)` in the matrix below, log in as a user whose role maps to that hub and confirm:

| Hub | Persona | Role | Must confirm |
|---|---|---|---|
| admin | Briefing do Dia | ADMIN | Card on empty state, click runs, output has TL;DR/Números/Ação |
| financial | Raio-X Financeiro | FINANCE | Card on empty state, click runs, output mentions QB data |
| commercial | Pulso do Pipeline | SALES (or SDR/COMMERCIAL) | Card on empty state, click runs, output mentions funil/leads |
| operational | Status da Base | OPERATIONAL (or SUPPORT) | Card on empty state, click runs, output mentions fases/alunos |

- [ ] **Step 3: Confirm cache behavior**

- First click after the card shows a streamed response; DB has one new `PersonaCacheEntry` and one `PersonaCacheRead`.
- Refresh the page and click the persona **chip** above the composer → response appears instantly (cache hit, first read — but actually this user already read the bucket from step 1, so it routes through delta).
- **As a different user** with the same role, visit the same hub → first click returns the cached content instantly (streamed as a single chunk); a second `PersonaCacheRead` row is created.
- Click "Atualizar" on the persona badge → a new response generates; `PersonaCacheEntry.generatedAt` updates.

- [ ] **Step 4: Confirm RBAC and error paths**

- As FINANCE user, craft a POST to `/api/dashboard/ai/chat` with `hub: "financial"` and `personaSlug: "ceo-brief"` (wrong hub). Expect `400` "persona não pertence a este hub".
- As SALES user, visit `/dashboard/financial/ai`. Expect the hub guard blocks access before the persona UI renders (pre-existing behavior).
- Set `AI_PERSONAS_ENABLED=false`, restart dev. Expect the PersonaCard/Chip disappear; chat works exactly as before.

- [ ] **Step 5: Clean up and commit the smoke-test log**

Create `docs/superpowers/specs/2026-04-14-ai-personas-smoke.md` with a short log of what you tested (one line per matrix row, pass/fail, date, any surprises).

```bash
git add docs/superpowers/specs/2026-04-14-ai-personas-smoke.md
git commit -m "docs(ai-personas): record V1 smoke test results"
```

---

## Self-Review

**Spec coverage:**
- Empty state vs active chat → Task 14 (conditional render)
- Message metadata badge → Task 15
- Delta mode per user → Tasks 7 (alreadyRead detection) + 8 (delta prompt) + 9 (no cache write on delta)
- BLUF output contract → Task 2 (`BLUF_CONTRACT` in `systemAppend`)
- 4 personas with tool whitelists → Task 2
- Admin tool whitelist = union of other hubs' tools → Task 2 (explicit list covers finance + leads + students + ops)
- `lib/ai/personas.ts` type + helpers → Task 2
- Chat route `personaSlug` + `refresh` handling → Tasks 6, 7, 8, 9, 10
- `PersonaCacheEntry`, `PersonaCacheRead` Prisma models → Task 1
- `dayBucket` computation with worked example → Task 3 (with tests)
- Tool whitelist enforcement at SDK boundary → Task 5 + Task 8 Step 4
- `PersonaCard`, `PersonaChip`, `PersonaMessageMeta` components → Tasks 11, 12, 13
- Error handling (role mismatch, unknown slug, fallback on cache write failure) → Task 6 (validation), Task 7 (idempotent `recordRead`), onFinish is already wrapped in try/catch upstream
- Testing (unit + manual E2E) → Tasks 2, 3, 5 (unit), Task 16 (smoke)
- Rollout flag → Task 1 + Task 6 gates via `AI_PERSONAS_ENABLED`

**Placeholder scan:** none present.

**Type consistency:** `PersonaDefinition` defined once in Task 2; all later tasks import it. `computeDayBucket`, `lookupPersonaCache`, `recordPersonaCacheRead`, `writePersonaCache`, `filterToolsByWhitelist` — names used consistently across Tasks 3–15. Prisma unique constraint names (`personaSlug_dayBucket`, `personaSlug_dayBucket_userId`) match the `@@unique` tuple order in Task 1.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-14-ai-personas.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
