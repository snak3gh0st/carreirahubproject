# Ops Hub — Aba AI + Widget Digisac Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar aba AI (ChatPanel operational) e widget Digisac flutuante com badge de não-lidos ao Ops Hub.

**Architecture:** Hook `useOpsDigisacUnread` centraliza o polling do Digisac e é compartilhado pelo badge do sidebar e pelo FAB widget. O `OpsQueryProvider` é movido para envolver o layout inteiro (sidebar + children) de modo que ambos possam usar React Query. A aba AI reutiliza `<ChatPanel hub="operational" />` sem nova lógica de backend.

**Tech Stack:** Next.js 14 App Router, React Query (tanstack), lucide-react, Tailwind CSS, `useQuery` + `useEffect` para click-outside

---

## File Map

| Arquivo | Ação |
|---|---|
| `app/ops/layout.tsx` | Modificar — mover OpsQueryProvider para envolver o layout todo + adicionar OpsDigisacWidget |
| `hooks/ops/useOpsDigisacUnread.ts` | Criar — hook compartilhado para unread count + threads |
| `components/ops/ops-sidebar.tsx` | Modificar — importar hook, adicionar badge em "Conversas", adicionar item "AI" com Sparkles |
| `components/ops/digisac/OpsDigisacWidget.tsx` | Criar — FAB + painel overlay + polling |
| `app/ops/digisac/page.tsx` | Modificar — ler `searchParams.thread` e passar como prop inicial |
| `components/ops/digisac/OpsDigisacInbox.tsx` | Modificar — aceitar `initialThreadId?: string` prop |
| `app/ops/ai/page.tsx` | Criar — server component com auth check |
| `app/ops/ai/OpsAiPageClient.tsx` | Criar — client component com ChatPanel |

---

## Task 1: Mover OpsQueryProvider para envolver o layout inteiro

**Motivo:** O sidebar e o widget flutuante ficam fora do `<main>`, mas precisam de React Query. Atualmente o `OpsQueryProvider` só envolve `children`.

**Files:**
- Modify: `app/ops/layout.tsx`

- [ ] **Passo 1: Atualizar layout.tsx**

Abrir `app/ops/layout.tsx`. Mover `OpsQueryProvider` para envolver o div inteiro:

```tsx
// ANTES (trecho atual dentro do return quando session existe):
return (
  <div data-portal="ops" className="min-h-screen bg-gray-50">
    <OpsSidebar userName={userName} userEmail={userEmail} userRole={userRole} />
    <main id="main-content" className="min-h-screen pb-24 pt-16 md:pb-0 md:pl-64 md:pt-0">
      <OpsQueryProvider>{children}</OpsQueryProvider>
    </main>
  </div>
);

// DEPOIS:
return (
  <OpsQueryProvider>
    <div data-portal="ops" className="min-h-screen bg-gray-50">
      <OpsSidebar userName={userName} userEmail={userEmail} userRole={userRole} />
      <main id="main-content" className="min-h-screen pb-24 pt-16 md:pb-0 md:pl-64 md:pt-0">
        {children}
      </main>
    </div>
  </OpsQueryProvider>
);
```

- [ ] **Passo 2: Verificar que não quebrou nada**

```bash
npx tsc --noEmit 2>&1 | grep "layout"
```

Esperado: sem erros relacionados a layout.tsx

- [ ] **Passo 3: Commit**

```bash
git add app/ops/layout.tsx
git commit -m "refactor: move OpsQueryProvider to wrap full ops layout shell"
```

---

## Task 2: Hook useOpsDigisacUnread

**Files:**
- Create: `hooks/ops/useOpsDigisacUnread.ts`

- [ ] **Passo 1: Criar o diretório e o hook**

Criar `hooks/ops/useOpsDigisacUnread.ts`:

```typescript
"use client";
import { useQuery } from "@tanstack/react-query";

export type DigisacThreadPreview = {
  id: string;
  displayName: string;
  phoneNumber: string;
  needsReply: boolean;
  lastMessageAt: string | null;
  latestMessage: {
    content: string;
    direction: "INBOUND" | "OUTBOUND" | "SYSTEM";
    externalCreatedAt: string | null;
    createdAt: string;
  } | null;
  customer: { id: string; name: string } | null;
  enrollment: { id: string } | null;
};

type DigisacListResponse = {
  config: { enabled: boolean; missing: string[] };
  stats: { total: number; needsReply: number; unmatched: number; activeEnrollments: number };
  threads: DigisacThreadPreview[];
  migrationRequired?: boolean;
};

export function useOpsDigisacUnread() {
  const query = useQuery<DigisacListResponse>({
    queryKey: ["ops-digisac-threads"],
    queryFn: async () => {
      const res = await fetch("/api/ops/digisac");
      if (!res.ok) throw new Error("Falha ao carregar Digisac.");
      return res.json();
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const unreadCount = query.data?.stats.needsReply ?? 0;
  const threads = query.data?.threads ?? [];
  const enabled = query.data?.config.enabled !== false;
  const migrationRequired = query.data?.migrationRequired ?? false;

  return { unreadCount, threads, enabled, migrationRequired, isLoading: query.isLoading };
}
```

- [ ] **Passo 2: Verificar tipos**

```bash
npx tsc --noEmit 2>&1 | grep "useOpsDigisacUnread"
```

Esperado: sem erros

- [ ] **Passo 3: Commit**

```bash
git add hooks/ops/useOpsDigisacUnread.ts
git commit -m "feat: add useOpsDigisacUnread hook for shared Digisac polling"
```

---

## Task 3: Badge "Conversas" + item "AI" no sidebar

**Files:**
- Modify: `components/ops/ops-sidebar.tsx`

- [ ] **Passo 1: Atualizar imports no sidebar**

No topo de `components/ops/ops-sidebar.tsx`, adicionar `Sparkles` ao import do lucide-react e importar o hook:

```typescript
// Adicionar Sparkles ao import existente de lucide-react:
import {
  GraduationCap,
  LogOut,
  CalendarDays,
  BarChart3,
  ListChecks,
  MessageSquareText,
  Sparkles,
  UsersRound,
} from "lucide-react";

// Adicionar import do hook (após os imports existentes):
import { useOpsDigisacUnread } from "@/hooks/ops/useOpsDigisacUnread";
```

- [ ] **Passo 2: Usar o hook dentro do componente**

Dentro da função `OpsSidebar`, antes do `navItems`, adicionar:

```typescript
const { unreadCount } = useOpsDigisacUnread();
```

- [ ] **Passo 3: Adicionar item AI e badge em Conversas**

Substituir a definição de `navItems`:

```typescript
// ANTES:
const navItems: NavItem[] = [
  { href: "/ops", label: "Hoje", icon: CalendarDays },
  { href: "/ops/pipeline", label: "Clientes", icon: ListChecks },
  { href: "/ops/digisac", label: "Conversas", icon: MessageSquareText },
  { href: "/ops/enroll", label: "Matrículas", icon: GraduationCap },
  { href: "/ops/bi", label: "BI", icon: BarChart3 },
  ...(isOperationalManagerRole(userRole)
    ? [{ href: "/ops/team", label: "Gestão", icon: UsersRound }]
    : []),
];

// DEPOIS — adicionar badge opcional à interface e o item AI:
```

Primeiro atualizar a interface `NavItem`:

```typescript
interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}
```

Depois o array:

```typescript
const navItems: NavItem[] = [
  { href: "/ops", label: "Hoje", icon: CalendarDays },
  { href: "/ops/pipeline", label: "Clientes", icon: ListChecks },
  { href: "/ops/digisac", label: "Conversas", icon: MessageSquareText, badge: unreadCount > 0 ? unreadCount : undefined },
  { href: "/ops/enroll", label: "Matrículas", icon: GraduationCap },
  { href: "/ops/ai", label: "AI", icon: Sparkles },
  { href: "/ops/bi", label: "BI", icon: BarChart3 },
  ...(isOperationalManagerRole(userRole)
    ? [{ href: "/ops/team", label: "Gestão", icon: UsersRound }]
    : []),
];
```

- [ ] **Passo 4: Renderizar o badge no desktop sidebar e na bottom nav mobile**

No desktop sidebar, dentro do `.map((item) => { ... })`, substituir o conteúdo do `<Link>`:

```tsx
// ANTES:
<Link key={item.href} href={item.href} className={`...`}>
  <Icon className={`...`} />
  <span>{item.label}</span>
</Link>

// DEPOIS:
<Link key={item.href} href={item.href} className={`...`}>
  <Icon className={`...`} />
  <span className="flex-1">{item.label}</span>
  {item.badge !== undefined && (
    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
      {item.badge > 99 ? "99+" : item.badge}
    </span>
  )}
</Link>
```

Na bottom nav mobile, dentro do `.map((item) => { ... })`, envolver o ícone em relative para o badge:

```tsx
// ANTES:
<Link key={item.href} href={item.href} className={`...`}>
  <Icon className="h-5 w-5 flex-shrink-0" />
  <span className="max-w-full truncate">{item.label}</span>
</Link>

// DEPOIS:
<Link key={item.href} href={item.href} className={`...`}>
  <span className="relative">
    <Icon className="h-5 w-5 flex-shrink-0" />
    {item.badge !== undefined && (
      <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
        {item.badge > 99 ? "99+" : item.badge}
      </span>
    )}
  </span>
  <span className="max-w-full truncate">{item.label}</span>
</Link>
```

- [ ] **Passo 5: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep "ops-sidebar"
```

Esperado: sem erros

- [ ] **Passo 6: Commit**

```bash
git add components/ops/ops-sidebar.tsx hooks/ops/useOpsDigisacUnread.ts
git commit -m "feat: add AI sidebar item and Digisac unread badge to ops nav"
```

---

## Task 4: Widget Digisac Flutuante

**Files:**
- Create: `components/ops/digisac/OpsDigisacWidget.tsx`
- Modify: `app/ops/layout.tsx`

- [ ] **Passo 1: Criar OpsDigisacWidget.tsx**

Criar `components/ops/digisac/OpsDigisacWidget.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MessageSquareText, X } from "lucide-react";
import { useOpsDigisacUnread, type DigisacThreadPreview } from "@/hooks/ops/useOpsDigisacUnread";

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (diffDays === 0) return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function previewText(thread: DigisacThreadPreview) {
  const text = thread.latestMessage?.content ?? "";
  const single = text.replace(/\s+/g, " ").trim();
  return single.length > 55 ? `${single.slice(0, 55)}…` : single || "Sem mensagem";
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase()).join("") || "?";
}

export function OpsDigisacWidget() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const fabRef = useRef<HTMLButtonElement>(null);
  const { unreadCount, threads, enabled, migrationRequired } = useOpsDigisacUnread();

  // Close on click-outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current?.contains(e.target as Node) ||
        fabRef.current?.contains(e.target as Node)
      ) return;
      setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  // Show 8 most recent threads, unread first
  const sorted = [...threads]
    .sort((a, b) => {
      if (a.needsReply !== b.needsReply) return a.needsReply ? -1 : 1;
      const ta = a.lastMessageAt ?? "";
      const tb = b.lastMessageAt ?? "";
      return tb.localeCompare(ta);
    })
    .slice(0, 8);

  return (
    <>
      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          className="fixed bottom-20 right-4 z-50 w-80 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl md:bottom-24 md:right-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between bg-brand-verde px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-white" />
              <span className="text-sm font-bold text-white">Conversas</span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {unreadCount > 99 ? "99+" : unreadCount} nova{unreadCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Thread list */}
          <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
            {migrationRequired ? (
              <div className="px-4 py-6 text-center text-xs text-amber-700">
                Migration Digisac pendente. A inbox aparece vazia até a tabela existir.
              </div>
            ) : !enabled ? (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                Digisac não configurado.
              </div>
            ) : sorted.length === 0 ? (
              <div className="px-4 py-6 text-center text-xs text-gray-500">
                Nenhuma conversa ainda.
              </div>
            ) : (
              sorted.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/ops/digisac?thread=${thread.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 transition hover:bg-gray-50 ${
                    thread.needsReply ? "border-l-2 border-brand-tangerina bg-orange-50/40" : ""
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      thread.needsReply
                        ? "bg-orange-100 text-brand-tangerina"
                        : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {initials(thread.displayName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-gray-900">
                        {thread.displayName}
                      </p>
                      <span className="flex-shrink-0 text-[10px] text-gray-400">
                        {formatTime(
                          thread.latestMessage?.externalCreatedAt ??
                          thread.latestMessage?.createdAt ??
                          thread.lastMessageAt
                        )}
                      </span>
                    </div>
                    <p className="truncate text-xs text-gray-500">{previewText(thread)}</p>
                  </div>
                  {thread.needsReply && (
                    <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-tangerina" />
                  )}
                </Link>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 bg-gray-50 px-4 py-2.5 text-center">
            <Link
              href="/ops/digisac"
              onClick={() => setOpen(false)}
              className="text-xs font-semibold text-brand-verde hover:underline"
            >
              Ver todas as conversas →
            </Link>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        ref={fabRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Conversas Digisac"
        className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-brand-verde shadow-lg transition hover:bg-brand-verde/90 focus:outline-none focus:ring-2 focus:ring-brand-verde/50 md:bottom-6 md:right-6"
      >
        <MessageSquareText className="h-6 w-6 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}
```

- [ ] **Passo 2: Adicionar OpsDigisacWidget ao layout**

Em `app/ops/layout.tsx`, adicionar o import e o componente dentro do `OpsQueryProvider`, após o `<main>`:

```tsx
// Adicionar import:
import { OpsDigisacWidget } from "@/components/ops/digisac/OpsDigisacWidget";

// No return (quando session existe):
return (
  <OpsQueryProvider>
    <div data-portal="ops" className="min-h-screen bg-gray-50">
      <OpsSidebar userName={userName} userEmail={userEmail} userRole={userRole} />
      <main id="main-content" className="min-h-screen pb-24 pt-16 md:pb-0 md:pl-64 md:pt-0">
        {children}
      </main>
      <OpsDigisacWidget />
    </div>
  </OpsQueryProvider>
);
```

- [ ] **Passo 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "OpsDigisacWidget|layout"
```

Esperado: sem erros

- [ ] **Passo 4: Commit**

```bash
git add components/ops/digisac/OpsDigisacWidget.tsx app/ops/layout.tsx
git commit -m "feat: add floating Digisac widget with unread badge to ops hub"
```

---

## Task 5: Suporte a `?thread=` na página /ops/digisac

**Files:**
- Modify: `app/ops/digisac/page.tsx`
- Modify: `components/ops/digisac/OpsDigisacInbox.tsx`

- [ ] **Passo 1: Passar searchParam da página para o componente**

Em `app/ops/digisac/page.tsx`, adicionar `searchParams` e passá-lo como prop:

```tsx
// ANTES:
export default async function OpsDigisacPage() {
  // ...
  return (
    <div className="...">
      {/* ... header ... */}
      <OpsDigisacInbox />
    </div>
  );
}

// DEPOIS — adicionar searchParams ao tipo de props e passar initialThreadId:
export default async function OpsDigisacPage({
  searchParams,
}: {
  searchParams: { thread?: string };
}) {
  // ... (auth check igual ao atual) ...
  return (
    <div className="...">
      {/* ... header igual ... */}
      <OpsDigisacInbox initialThreadId={searchParams.thread} />
    </div>
  );
}
```

- [ ] **Passo 2: Aceitar initialThreadId em OpsDigisacInbox**

Em `components/ops/digisac/OpsDigisacInbox.tsx`, adicionar a prop:

```tsx
// ANTES:
export function OpsDigisacInbox() {
  // ...
  const [selectedId, setSelectedId] = useState<string | null>(null);

// DEPOIS:
export function OpsDigisacInbox({ initialThreadId }: { initialThreadId?: string }) {
  // ...
  const [selectedId, setSelectedId] = useState<string | null>(initialThreadId ?? null);
```

**Atenção — corrigir o `useEffect` de auto-seleção:** o efeito atual limpa `selectedId` quando `filteredThreads` está vazio (ainda carregando), o que sobrescreve o `initialThreadId`. Substituir o `useEffect` existente por:

```tsx
useEffect(() => {
  if (selectedId) {
    // Já tem seleção: manter se o thread existe na lista, ou se ainda está carregando
    if (filteredThreads.some((t) => t.id === selectedId)) return;
    if (filteredThreads.length === 0) return; // ainda carregando — não limpar
  }
  setSelectedId(filteredThreads[0]?.id ?? null);
}, [filteredThreads, selectedId]);
```

- [ ] **Passo 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "OpsDigisacInbox|digisac/page"
```

Esperado: sem erros

- [ ] **Passo 4: Commit**

```bash
git add app/ops/digisac/page.tsx components/ops/digisac/OpsDigisacInbox.tsx
git commit -m "feat: support ?thread= param in Digisac page for widget deep-link"
```

---

## Task 6: Página /ops/ai

**Files:**
- Create: `app/ops/ai/page.tsx`
- Create: `app/ops/ai/OpsAiPageClient.tsx`

- [ ] **Passo 1: Criar o client component**

Criar `app/ops/ai/OpsAiPageClient.tsx`:

```tsx
"use client";

import { ChatPanel } from "@/components/ai/ChatPanel";
import { useState } from "react";

export function OpsAiPageClient() {
  const [conversationId, setConversationId] = useState<string | undefined>();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:h-screen">
      <ChatPanel
        hub="operational"
        conversationId={conversationId}
        onNewConversationId={setConversationId}
      />
    </div>
  );
}
```

- [ ] **Passo 2: Criar o server component**

Criar `app/ops/ai/page.tsx`:

```tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isOperationalAccessRole } from "@/lib/roles";
import { OpsAiPageClient } from "./OpsAiPageClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operacional AI | Ops Hub" };

export default async function OpsAiPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const role = (session.user as { role?: string }).role;
  if (!isOperationalAccessRole(role)) redirect("/ops");

  return <OpsAiPageClient />;
}
```

- [ ] **Passo 3: Verificar TypeScript**

```bash
npx tsc --noEmit 2>&1 | grep -E "ops/ai"
```

Esperado: sem erros

- [ ] **Passo 4: Verificar build completo**

```bash
npm run build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully` sem erros

- [ ] **Passo 5: Commit**

```bash
git add app/ops/ai/page.tsx app/ops/ai/OpsAiPageClient.tsx
git commit -m "feat: add ops AI page with operational ChatPanel"
```

---

## Task 7: Commit do working tree pendente + push para deploy

**Contexto:** Há 19 arquivos modificados e 5 não-rastreados do trabalho anterior (Digisac + staff control). Precisam ser commitados antes do push final.

- [ ] **Passo 1: Verificar o estado atual**

```bash
git status --short
```

- [ ] **Passo 2: Commitar os arquivos do working tree (trabalho anterior)**

```bash
git add \
  app/api/ops/enrollments/[id]/digisac/route.ts \
  app/api/ops/digisac/ \
  app/ops/digisac/page.tsx \
  app/ops/students/[enrollmentId]/OpsStudentDigisacPanel.tsx \
  app/ops/bi/page.tsx \
  app/ops/coordinator/PhaseDistribution.tsx \
  app/ops/customers/[id]/page.tsx \
  app/ops/enroll/EnrollForm.tsx \
  app/ops/enroll/page.tsx \
  app/ops/my-tasks/MyTasksClient.tsx \
  app/ops/page.tsx \
  app/ops/pipeline/PipelineBoard.tsx \
  app/ops/pipeline/page.tsx \
  app/ops/students/[enrollmentId]/OperationalHubSection.tsx \
  app/ops/students/[enrollmentId]/StudentProfileClient.tsx \
  components/ops/bi/OpsBiCharts.tsx \
  lib/services/digisac.service.ts \
  lib/sidebar/role-config.ts \
  tests/head-operational-role.test.ts \
  tests/ops-customer-profile-copy.test.ts

git commit -m "feat: add ops Digisac inbox page, student panel, and staff control improvements"
```

- [ ] **Passo 3: Push para GitHub (dispara deploy automático)**

```bash
git push origin main
```

- [ ] **Passo 4: Verificar pipeline**

```bash
gh run list --repo snak3gh0st/carreirahubproject --limit 3
```

Esperado: novo run `Deploy CarreiraHub` com status `in_progress` ou `completed`.
