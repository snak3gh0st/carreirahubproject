# Hub-Segmented AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic dashboard AI with clean, hub-specific AI pages for Financeiro, Comercial, Operacional, and a strategic CEO-style Admin AI, while adding permanent conversation deletion in the sidebar and improving chat readability.

**Architecture:** Introduce a shared AI hub configuration layer that maps roles, routes, labels, prompts, and starter suggestions. Use that configuration across page routing, menu visibility, conversation scoping, and prompt construction so hub behavior lives in one place. Extend `AiConversation` with a persisted hub discriminator, then update the current AI APIs and UI shell to query and render conversations within the active hub only.

**Tech Stack:** Next.js App Router, React client components, Prisma/Postgres, NextAuth, Vercel AI SDK, node:test

---

## File Structure

### New files

- `lib/ai/hub-config.ts` — canonical AI hub definitions, role-to-hub mapping, route helpers, starter prompts, and prompt descriptors
- `components/ai/AiWorkspace.tsx` — shared page-level AI shell that composes header, sidebar, empty state, and chat panel for a given hub
- `components/ai/AiWorkspaceHeader.tsx` — clean executive header per hub page
- `components/ai/ConversationListItem.tsx` — row-level sidebar item with delete affordance and metadata
- `app/dashboard/financial/ai/page.tsx` — Financeiro AI page
- `app/dashboard/commercial/ai/page.tsx` — Comercial AI page
- `app/dashboard/operational/ai/page.tsx` — Operacional AI page
- `app/dashboard/admin/ai/page.tsx` — Admin AI page
- `tests/ai/hub-config.test.ts` — hub mapping and route helper tests
- `tests/ai/hub-prompt.test.ts` — prompt adaptation tests by hub
- `tests/ai/conversation-scope.test.ts` — conversation scoping and deletion behavior tests
- `prisma/migrations/<timestamp>_add_ai_conversation_hub/migration.sql` — persisted hub scope column and enum/value migration

### Modified files

- `prisma/schema.prisma` — add hub discriminator to `AiConversation`
- `app/api/dashboard/ai/chat/route.ts` — require active hub, create/load scoped conversations, pass hub to prompt builder
- `app/api/dashboard/ai/conversations/route.ts` — filter list/delete operations by hub
- `app/api/dashboard/ai/conversations/[id]/route.ts` — enforce hub-aware fetch behavior
- `app/dashboard/ai/page.tsx` — redirect legacy generic AI route to the role-appropriate hub AI
- `components/ai/ConversationSidebar.tsx` — load scoped conversations, refresh after delete, render richer list items
- `components/ai/ChatPanel.tsx` — accept active hub, load scoped messages, reset after active conversation delete, use hub-specific starter prompts
- `components/ai/MessageList.tsx` — widen and refine reading surface spacing
- `components/ai/MessageBubble.tsx` — improve markdown typography and response readability
- `components/ai/Suggestions.tsx` — support richer layout for hub-specific prompts
- `components/dashboard/professional-sidebar.tsx` — add AI entries per hub/role
- `app/dashboard/layout.tsx` — disable or redirect the generic AI floating bubble for team roles
- `lib/ai/prompts/system.pt-br.ts` — accept hub prompt context and tone descriptors
- `lib/ai/suggestions-by-role.ts` — migrate to hub-based suggestions or wrap the new hub config helper

---

### Task 1: Create the AI Hub Domain Model

**Files:**
- Create: `lib/ai/hub-config.ts`
- Test: `tests/ai/hub-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";

import {
  AI_HUBS,
  getAiHubForRole,
  getAiRouteForRole,
  getAiHubBySlug,
} from "../../lib/ai/hub-config.ts";

test("getAiHubForRole maps team roles to the correct hub", () => {
  assert.equal(getAiHubForRole("FINANCE"), "FINANCIAL");
  assert.equal(getAiHubForRole("SALES"), "COMMERCIAL");
  assert.equal(getAiHubForRole("SDR"), "COMMERCIAL");
  assert.equal(getAiHubForRole("COMMERCIAL"), "COMMERCIAL");
  assert.equal(getAiHubForRole("OPERATIONAL"), "OPERATIONAL");
  assert.equal(getAiHubForRole("SUPPORT"), "OPERATIONAL");
  assert.equal(getAiHubForRole("ADMIN"), "ADMIN_EXECUTIVE");
});

test("getAiRouteForRole points each role to the right page", () => {
  assert.equal(getAiRouteForRole("FINANCE"), "/dashboard/financial/ai");
  assert.equal(getAiRouteForRole("SALES"), "/dashboard/commercial/ai");
  assert.equal(getAiRouteForRole("ADMIN"), "/dashboard/admin/ai");
});

test("hub metadata exposes labels and starter prompts", () => {
  assert.equal(AI_HUBS.FINANCIAL.label, "Financeiro AI");
  assert.ok(AI_HUBS.ADMIN_EXECUTIVE.starterPrompts.length >= 3);
  assert.equal(getAiHubBySlug("operational")?.key, "OPERATIONAL");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai/hub-config.test.ts`

Expected: FAIL with module-not-found or missing export errors for `lib/ai/hub-config.ts`.

- [ ] **Step 3: Write minimal implementation**

```ts
export type AiHubKey =
  | "FINANCIAL"
  | "COMMERCIAL"
  | "OPERATIONAL"
  | "ADMIN_EXECUTIVE";

type HubConfig = {
  key: AiHubKey;
  slug: string;
  label: string;
  route: string;
  allowedRoles: string[];
  starterPrompts: string[];
  promptFocus: string;
};

export const AI_HUBS: Record<AiHubKey, HubConfig> = {
  FINANCIAL: {
    key: "FINANCIAL",
    slug: "financial",
    label: "Financeiro AI",
    route: "/dashboard/financial/ai",
    allowedRoles: ["FINANCE"],
    starterPrompts: [
      "Quais faturas estão vencidas há mais de 15 dias?",
      "Como está o caixa e o risco de recebimento desta semana?",
      "Quais ações financeiras precisam de decisão hoje?",
    ],
    promptFocus: "decisão financeira rápida com foco em caixa, cobrança e risco",
  },
  COMMERCIAL: {
    key: "COMMERCIAL",
    slug: "commercial",
    label: "Comercial AI",
    route: "/dashboard/commercial/ai",
    allowedRoles: ["SALES", "SDR", "COMMERCIAL"],
    starterPrompts: [
      "Quais leads mais quentes precisam de follow-up hoje?",
      "Onde está o maior gargalo do pipeline agora?",
      "Que decisão comercial pode acelerar conversão esta semana?",
    ],
    promptFocus: "pipeline, conversão, prioridades comerciais e alocação de atenção",
  },
  OPERATIONAL: {
    key: "OPERATIONAL",
    slug: "operational",
    label: "Operacional AI",
    route: "/dashboard/operational/ai",
    allowedRoles: ["OPERATIONAL", "SUPPORT"],
    starterPrompts: [
      "Quais alunos estão travados e precisam de ação imediata?",
      "Onde está o maior gargalo operacional hoje?",
      "O que precisa de decisão rápida para não atrasar o fluxo?",
    ],
    promptFocus: "execução operacional, gargalos e próximos passos claros",
  },
  ADMIN_EXECUTIVE: {
    key: "ADMIN_EXECUTIVE",
    slug: "admin",
    label: "Admin AI",
    route: "/dashboard/admin/ai",
    allowedRoles: ["ADMIN"],
    starterPrompts: [
      "Qual é a principal decisão executiva que preciso tomar hoje?",
      "Onde estão os maiores riscos entre receita, operação e execução?",
      "O que exige minha atenção como CEO nesta semana?",
    ],
    promptFocus: "síntese estratégica de CEO, risco, margem, crescimento e tradeoffs",
  },
};

export function getAiHubForRole(role: string): AiHubKey | null {
  return (
    Object.values(AI_HUBS).find((hub) => hub.allowedRoles.includes(role))?.key ?? null
  );
}

export function getAiRouteForRole(role: string): string {
  return getAiHubForRole(role) ? AI_HUBS[getAiHubForRole(role)!].route : "/dashboard";
}

export function getAiHubBySlug(slug: string) {
  return Object.values(AI_HUBS).find((hub) => hub.slug === slug) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai/hub-config.test.ts`

Expected: PASS for all hub mapping assertions.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/hub-config.ts tests/ai/hub-config.test.ts
git commit -m "feat: add shared ai hub configuration"
```

### Task 2: Persist Hub Scope in AI Conversations

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_add_ai_conversation_hub/migration.sql`
- Test: `tests/ai/conversation-scope.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("AiConversation schema persists the hub discriminator", () => {
  const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
  assert.match(schema, /enum AiHub/);
  assert.match(schema, /hub\\s+AiHub/);
  assert.match(schema, /@@index\\(\\[userId, hub, updatedAt\\]\\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai/conversation-scope.test.ts`

Expected: FAIL because `enum AiHub` and `hub AiHub` are not present yet.

- [ ] **Step 3: Write minimal implementation**

Add this Prisma shape:

```prisma
enum AiHub {
  FINANCIAL
  COMMERCIAL
  OPERATIONAL
  ADMIN_EXECUTIVE
}

model AiConversation {
  id        String       @id @default(cuid())
  userId    String
  user      User         @relation(fields: [userId], references: [id])
  hub       AiHub
  title     String?
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt
  messages  AiMessage[]

  @@index([userId, hub, updatedAt])
  @@map("ai_conversations")
}
```

Create a migration that:

- adds enum `AiHub`
- adds non-null `hub` column to `ai_conversations`
- backfills existing rows to a safe default such as `ADMIN_EXECUTIVE`

Then run:

```bash
npx prisma generate
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai/conversation-scope.test.ts`

Expected: PASS on schema assertions.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations tests/ai/conversation-scope.test.ts
git commit -m "feat: persist ai conversation hub scope"
```

### Task 3: Make AI APIs Hub-Aware

**Files:**
- Modify: `app/api/dashboard/ai/chat/route.ts`
- Modify: `app/api/dashboard/ai/conversations/route.ts`
- Modify: `app/api/dashboard/ai/conversations/[id]/route.ts`
- Modify: `lib/ai/prompts/system.pt-br.ts`
- Modify: `lib/ai/suggestions-by-role.ts`
- Modify: `tests/ai/conversation-scope.test.ts`
- Create: `tests/ai/hub-prompt.test.ts`

- [ ] **Step 1: Write the failing tests**

Add prompt coverage:

```ts
import test from "node:test";
import assert from "node:assert/strict";

import { buildSystemPrompt } from "../../lib/ai/prompts/system.pt-br.ts";

test("buildSystemPrompt adapts tone for Admin AI", () => {
  const prompt = buildSystemPrompt({
    userName: "Paulo",
    userRole: "ADMIN",
    currentDate: "2026-04-14",
    pageContext: "Usuário está em /dashboard/admin/ai",
    toolNames: ["getInvoices"],
    hubLabel: "Admin AI",
    hubFocus: "síntese estratégica de CEO",
  });

  assert.match(prompt, /Admin AI/);
  assert.match(prompt, /CEO/);
  assert.match(prompt, /síntese estratégica/);
});
```

Extend route coverage:

```ts
test("conversation list route reads hub from query string", async () => {
  const src = fs.readFileSync("app/api/dashboard/ai/conversations/route.ts", "utf8");
  assert.match(src, /searchParams\\.get\\(['"]hub['"]\\)/);
  assert.match(src, /where:\\s*\\{[^}]*userId[^}]*hub/s);
});

test("chat route creates conversations with hub scope", async () => {
  const src = fs.readFileSync("app/api/dashboard/ai/chat/route.ts", "utf8");
  assert.match(src, /conversationHub|hub/);
  assert.match(src, /prisma\\.aiConversation\\.create\\(/);
  assert.match(src, /hub:/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
node --test tests/ai/conversation-scope.test.ts tests/ai/hub-prompt.test.ts
```

Expected: FAIL because prompt inputs and route hub handling are not implemented yet.

- [ ] **Step 3: Write minimal implementation**

Make these changes:

1. Update `buildSystemPrompt` signature:

```ts
export interface SystemPromptInput {
  userName: string;
  userRole: string;
  currentDate: string;
  pageContext: string;
  toolNames: string[];
  hubLabel: string;
  hubFocus: string;
}
```

2. Add hub-specific language inside the prompt:

```ts
Seu contexto ativo é ${hubLabel}.
Prioridade deste copiloto: ${hubFocus}.
Adapte a profundidade e o framing das respostas para este hub.
```

3. In `app/api/dashboard/ai/chat/route.ts`:

- read `hub` from request body
- validate it against `AI_HUBS`
- when loading an existing conversation, require `{ id, userId, hub }`
- when creating a new conversation, persist `hub`
- pass `hubLabel` and `hubFocus` to `buildSystemPrompt`

4. In `app/api/dashboard/ai/conversations/route.ts`:

- read `hub` from query string
- filter list and delete by `{ userId, hub }`

5. In `app/api/dashboard/ai/conversations/[id]/route.ts`:

- require `hub` query param or derive it from validated hub slug input
- filter `findFirst` by `{ id, userId, hub }`

6. Replace role-only suggestions lookup with hub-aware suggestions using `AI_HUBS[hub].starterPrompts`.

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
node --test tests/ai/conversation-scope.test.ts tests/ai/hub-prompt.test.ts
```

Expected: PASS on schema, route, and prompt assertions.

- [ ] **Step 5: Commit**

```bash
git add app/api/dashboard/ai/chat/route.ts app/api/dashboard/ai/conversations/route.ts app/api/dashboard/ai/conversations/[id]/route.ts lib/ai/prompts/system.pt-br.ts lib/ai/suggestions-by-role.ts tests/ai/conversation-scope.test.ts tests/ai/hub-prompt.test.ts
git commit -m "feat: scope ai routes and prompts by hub"
```

### Task 4: Build the Shared Hub AI Workspace Pages

**Files:**
- Create: `components/ai/AiWorkspace.tsx`
- Create: `components/ai/AiWorkspaceHeader.tsx`
- Modify: `components/ai/ChatPanel.tsx`
- Modify: `components/ai/Suggestions.tsx`
- Create: `app/dashboard/financial/ai/page.tsx`
- Create: `app/dashboard/commercial/ai/page.tsx`
- Create: `app/dashboard/operational/ai/page.tsx`
- Create: `app/dashboard/admin/ai/page.tsx`
- Modify: `app/dashboard/ai/page.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("hub ai pages exist for all required business areas", () => {
  for (const file of [
    "app/dashboard/financial/ai/page.tsx",
    "app/dashboard/commercial/ai/page.tsx",
    "app/dashboard/operational/ai/page.tsx",
    "app/dashboard/admin/ai/page.tsx",
  ]) {
    assert.equal(fs.existsSync(file), true, `${file} should exist`);
  }
});

test("legacy dashboard ai page redirects to a role-specific hub route", () => {
  const src = fs.readFileSync("app/dashboard/ai/page.tsx", "utf8");
  assert.match(src, /redirect|router\\.replace/);
  assert.match(src, /getAiRouteForRole/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai/hub-config.test.ts`

Expected: FAIL because the page files and redirect logic do not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a shared page shell:

```tsx
export function AiWorkspace({ hub }: { hub: AiHubKey }) {
  const config = AI_HUBS[hub];

  return (
    <div className="min-h-screen bg-[#f4f6f2]">
      <div className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1600px] gap-4 p-4">
        <ConversationSidebar hub={hub} />
        <section className="min-w-0 flex-1 rounded-[28px] border border-black/5 bg-white shadow-[0_12px_40px_rgba(23,53,44,0.06)]">
          <AiWorkspaceHeader hub={hub} />
          <ChatPanel hub={hub} />
        </section>
      </div>
    </div>
  );
}
```

Each page file should:

- read session role server-side
- validate access against `AI_HUBS`
- redirect unauthorized users to `/dashboard`
- render `AiWorkspace`

Update `app/dashboard/ai/page.tsx` to redirect to `getAiRouteForRole(role)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai/hub-config.test.ts`

Expected: PASS on route helper and page existence coverage.

- [ ] **Step 5: Commit**

```bash
git add components/ai/AiWorkspace.tsx components/ai/AiWorkspaceHeader.tsx components/ai/ChatPanel.tsx components/ai/Suggestions.tsx app/dashboard/financial/ai/page.tsx app/dashboard/commercial/ai/page.tsx app/dashboard/operational/ai/page.tsx app/dashboard/admin/ai/page.tsx app/dashboard/ai/page.tsx tests/ai/hub-config.test.ts
git commit -m "feat: add shared hub-specific ai workspace pages"
```

### Task 5: Add Sidebar Conversation Delete and Hub-Scoped History UI

**Files:**
- Create: `components/ai/ConversationListItem.tsx`
- Modify: `components/ai/ConversationSidebar.tsx`
- Modify: `components/ai/ChatPanel.tsx`
- Modify: `tests/ai/conversation-scope.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("ConversationSidebar deletes scoped conversations through the route query", () => {
  const src = fs.readFileSync("components/ai/ConversationSidebar.tsx", "utf8");
  assert.match(src, /method:\\s*['"]DELETE['"]/);
  assert.match(src, /\\?id=\\$\\{/);
  assert.match(src, /hub=/);
  assert.match(src, /window\\.confirm/);
});

test("ChatPanel resets when the active conversation is deleted", () => {
  const src = fs.readFileSync("components/ai/ChatPanel.tsx", "utf8");
  assert.match(src, /onConversationDeleted|setMessages\\(\\[\\]\\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai/conversation-scope.test.ts`

Expected: FAIL because sidebar deletion is not implemented per conversation row and active reset logic is incomplete.

- [ ] **Step 3: Write minimal implementation**

Implement a row component such as:

```tsx
export function ConversationListItem({ conversation, active, onOpen, onDelete }: Props) {
  return (
    <div className="group flex items-center gap-2 rounded-2xl px-3 py-2 hover:bg-[#eef3ee]">
      <button onClick={() => onOpen(conversation.id)} className="min-w-0 flex-1 text-left">
        <div className="truncate text-sm font-medium text-[#17352c]">{conversation.title}</div>
        <div className="mt-1 text-[11px] text-[#6f7d73]">{conversation.updatedLabel}</div>
      </button>
      <button
        onClick={() => onDelete(conversation.id)}
        className="opacity-0 transition group-hover:opacity-100"
        aria-label="Excluir conversa"
      >
        …
      </button>
    </div>
  );
}
```

Update `ConversationSidebar` to:

- accept `hub`
- fetch `/api/dashboard/ai/conversations?hub=${hub}`
- send `DELETE /api/dashboard/ai/conversations?id=${id}&hub=${hub}`
- confirm before deletion
- refresh list after deletion
- notify parent if the deleted ID was active

Update `ChatPanel` to:

- accept `hub`
- pass `hub` in all chat and fetch requests
- clear messages and selection when the active conversation is deleted

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai/conversation-scope.test.ts`

Expected: PASS on sidebar deletion and reset assertions.

- [ ] **Step 5: Commit**

```bash
git add components/ai/ConversationListItem.tsx components/ai/ConversationSidebar.tsx components/ai/ChatPanel.tsx tests/ai/conversation-scope.test.ts
git commit -m "feat: add scoped conversation deletion in ai sidebar"
```

### Task 6: Refresh the Chat UI for Clean Executive Readability

**Files:**
- Modify: `components/ai/MessageBubble.tsx`
- Modify: `components/ai/MessageList.tsx`
- Modify: `components/ai/Suggestions.tsx`
- Modify: `components/ai/ToolCallCard.tsx`

- [ ] **Step 1: Write the failing test**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("assistant bubbles use a calmer reading surface and stronger prose spacing", () => {
  const src = fs.readFileSync("components/ai/MessageBubble.tsx", "utf8");
  assert.match(src, /max-w-\\[min\\(920px,92%\\)\\]/);
  assert.match(src, /prose-headings|prose-p|prose-li/);
});

test("message list provides wider page padding and reading rhythm", () => {
  const src = fs.readFileSync("components/ai/MessageList.tsx", "utf8");
  assert.match(src, /mx-auto/);
  assert.match(src, /max-w-\\[1100px\\]/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai/hub-prompt.test.ts tests/ai/conversation-scope.test.ts`

Expected: FAIL because the current chat UI still uses the cramped bubble/layout classes.

- [ ] **Step 3: Write minimal implementation**

Upgrade the visual treatment:

- In `MessageList`, wrap message content in a centered reading container:

```tsx
<div className="flex-1 overflow-y-auto px-4 py-6 md:px-8">
  <div className="mx-auto flex max-w-[1100px] flex-col gap-4">
```

- In `MessageBubble`, use:

```tsx
<div className="max-w-[min(920px,92%)] rounded-[24px] border border-black/5 bg-white px-5 py-4 shadow-[0_10px_30px_rgba(23,53,44,0.05)]">
```

- Apply richer prose classes:

```tsx
className="prose prose-sm max-w-none prose-headings:mb-3 prose-headings:mt-6 prose-p:leading-7 prose-p:text-[#24342d] prose-li:my-1 prose-strong:text-[#10251e]"
```

- Tighten suggestion chips into a cleaner grid or wrapped layout under the empty state.
- Ensure `ToolCallCard` uses the same surface language as assistant results so the page feels cohesive.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
node --test tests/ai/hub-prompt.test.ts tests/ai/conversation-scope.test.ts
```

Expected: PASS on class-level UI assertions.

- [ ] **Step 5: Commit**

```bash
git add components/ai/MessageBubble.tsx components/ai/MessageList.tsx components/ai/Suggestions.tsx components/ai/ToolCallCard.tsx
git commit -m "feat: refresh ai chat reading surface"
```

### Task 7: Add Role-Aware AI Menu Entries and Retire the Generic Bubble

**Files:**
- Modify: `components/dashboard/professional-sidebar.tsx`
- Modify: `app/dashboard/layout.tsx`
- Modify: `tests/ai/hub-config.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
test("dashboard sidebar exposes the correct AI menu labels by role", () => {
  const src = fs.readFileSync("components/dashboard/professional-sidebar.tsx", "utf8");
  assert.match(src, /Financeiro AI/);
  assert.match(src, /Comercial AI/);
  assert.match(src, /Operacional AI/);
  assert.match(src, /Admin AI/);
});

test("dashboard layout no longer mounts a generic ChatBubble for team roles", () => {
  const src = fs.readFileSync("app/dashboard/layout.tsx", "utf8");
  assert.doesNotMatch(src, /<ChatBubble\\s*\\/?>/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/ai/hub-config.test.ts`

Expected: FAIL because sidebar entries do not exist and the generic bubble is still mounted.

- [ ] **Step 3: Write minimal implementation**

In `components/dashboard/professional-sidebar.tsx`:

- import `AI_HUBS` or a helper that returns the visible AI nav item for the current role
- append one AI entry to the role's navigation
- use the explicit labels from the spec

In `app/dashboard/layout.tsx`:

- remove `ChatBubble` import and render path for team roles
- keep `SupportChatBubble` logic unchanged for non-team users

If preserving a quick entry is necessary, replace the removed bubble with a plain deep link inside existing hub pages, not a global floating chatbot.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/ai/hub-config.test.ts`

Expected: PASS on menu visibility and generic bubble removal assertions.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/professional-sidebar.tsx app/dashboard/layout.tsx tests/ai/hub-config.test.ts
git commit -m "feat: add hub ai navigation entries"
```

### Task 8: Final Verification

**Files:**
- Verify: `tests/ai/hub-config.test.ts`
- Verify: `tests/ai/hub-prompt.test.ts`
- Verify: `tests/ai/conversation-scope.test.ts`

- [ ] **Step 1: Run targeted test suite**

Run:

```bash
node --test tests/ai/hub-config.test.ts tests/ai/hub-prompt.test.ts tests/ai/conversation-scope.test.ts
```

Expected: all tests PASS.

- [ ] **Step 2: Run Prisma client generation**

Run:

```bash
npx prisma generate
```

Expected: Prisma client generated successfully with the new `AiHub` enum and `AiConversation.hub`.

- [ ] **Step 3: Run a production sanity build**

Run:

```bash
npm run build
```

Expected: Next.js build succeeds without route or type errors.

- [ ] **Step 4: Manual smoke checks**

Run the dev server and verify:

1. a Finance user lands on `/dashboard/financial/ai`
2. a Sales/SDR/Commercial user lands on `/dashboard/commercial/ai`
3. an Operational/Support user lands on `/dashboard/operational/ai`
4. an Admin user lands on `/dashboard/admin/ai`
5. deleting the active conversation clears the chat pane
6. conversation lists do not leak across hubs
7. assistant responses feel wider and easier to read

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: ship segmented ai hubs"
```

---

## Self-Review

- Spec coverage: includes segmented pages, role-aware menu entries, permanent delete, improved readability, scoped conversation history, and Admin CEO framing.
- Placeholder scan: no `TODO`/`TBD` markers remain.
- Type consistency: uses the same hub keys and route model across config, Prisma, API, and UI tasks.

