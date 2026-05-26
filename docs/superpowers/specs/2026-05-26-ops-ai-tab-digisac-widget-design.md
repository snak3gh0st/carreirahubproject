# Ops Hub — Aba AI + Widget Digisac Flutuante

**Data:** 2026-05-26  
**Status:** Aprovado

---

## Objetivo

Adicionar dois pontos de acesso no Ops Hub:

1. **Aba AI** — área dedicada ao assistente Operacional AI (chat com persona ops)
2. **Widget Digisac flutuante** — notificação persistente de mensagens não respondidas + acesso rápido inline, disponível em qualquer página ops

A implementação deve usar as skills `stitch-design-taste` e `impeccable` para garantir acabamento visual consistente com o padrão do produto.

---

## Fora de escopo

- Collection calls (Dograh/Twilio) — pertence ao hub Financeiro, não ao Ops
- Redesign completo das páginas ops existentes
- Novo backend AI — reutiliza `/api/dashboard/ai/chat` existente

---

## 1. Aba AI (`/ops/ai`)

### Comportamento

- Rota: `/ops/ai`
- Auth: mesmas regras do layout ops (`isOperationalAccessRole`)
- Renderiza `<ChatPanel hub="operational" />` — componente já existente em `components/ai/ChatPanel.tsx`
- O hub `"operational"` já está configurado em `lib/ai/hub-config.ts` com foco, personas e starter prompts

### Sidebar

- Novo item no `OpsSidebar`: ícone `Sparkles` (lucide), label "AI"
- Posição: após "Matrículas", antes de "BI"
- Sem badge (não há contagem aplicável)

### Arquivos

| Arquivo | Ação |
|---|---|
| `app/ops/ai/page.tsx` | Criar — server component com auth check, renderiza `<OpsAiPageClient />` |
| `app/ops/ai/OpsAiPageClient.tsx` | Criar — client component com `<ChatPanel hub="operational" />` |
| `components/ops/ops-sidebar.tsx` | Atualizar — adicionar item AI com `Sparkles` |

---

## 2. Widget Digisac Flutuante

### Comportamento

- Componente `OpsDigisacWidget` adicionado ao `app/ops/layout.tsx`
- **Visível em todas as páginas `/ops/*`** (exceto login)
- Botão FAB (floating action button) fixo no canto inferior direito
  - Em mobile: posicionado acima da bottom nav (z-index superior)
  - Em desktop: `fixed bottom-6 right-6`
- **Badge vermelho** com contagem de `needsReply` quando > 0
- Clique no FAB abre/fecha o painel overlay

### Painel overlay

- Largura: 320px (desktop), full-width (mobile)
- Ancoragem: `bottom-20 right-4` (acima do FAB)
- Header: "Conversas" + badge com contagem
- Lista de threads: máx 8, ordenado por `lastMessageAt desc`, não-lidos primeiro
  - Thread não-lida: borda esquerda tangerina, fundo `#fff7ed`
  - Preview: nome, última mensagem (truncada), horário
- Click numa thread: navega para `/ops/digisac?thread=<threadId>` (a página `/ops/digisac` já lê o param e auto-seleciona)
- Footer: "Ver todas as conversas →" → `/ops/digisac`
- Fecha ao clicar fora (click-outside) ou ao pressionar Escape

### Badge no sidebar "Conversas"

- O item "Conversas" no `OpsSidebar` exibe o mesmo count de `needsReply`
- Compartilha o mesmo React Query cache key `["ops-digisac-threads"]` — zero requests extras

### Dados

- Fonte: `GET /api/ops/digisac` — já retorna `stats.needsReply` e lista de threads com `needsReply: boolean`
- Poll: 30s (mesmo intervalo do `OpsDigisacInbox` existente)
- Quando Digisac não configurado (`config.enabled = false`): widget não renderiza badge, painel mostra aviso

### Arquivos

| Arquivo | Ação |
|---|---|
| `components/ops/digisac/OpsDigisacWidget.tsx` | Criar — FAB + painel overlay + polling |
| `app/ops/layout.tsx` | Atualizar — importar e renderizar `<OpsDigisacWidget />` |
| `components/ops/ops-sidebar.tsx` | Atualizar — badge dinâmico no item "Conversas" |

### Hook compartilhado

Criar `hooks/useOpsDigisacUnread.ts`:
- Wrapper sobre `useQuery({ queryKey: ["ops-digisac-threads"], ... })`
- Retorna `{ unreadCount, threads, isLoading }`
- Usado por: `OpsDigisacWidget` e `OpsSidebar` (badge)

---

## 3. Página `/ops/digisac` — ajuste de URL param

A página existente já tem `selectedId` como estado local. Adicionar suporte a `?thread=<id>`:
- Na montagem, ler `searchParams.get("thread")` e setar como `selectedId` inicial
- Permite que o widget navegue direto para uma thread específica

---

## 4. UI/UX

- Seguir paleta existente: `brand-verde` (#1a5c38), `brand-tangerina` (#f07030), `brand-creme`
- Aplicar skills `stitch-design-taste` e `impeccable` durante implementação dos novos componentes
- FAB: `shadow-lg`, transição suave ao abrir/fechar painel (fade + slide-up)
- Badge: vermelho `#ef4444`, borda branca 2px para destacar sobre o FAB verde

---

## 5. Ordem de implementação

1. Hook `useOpsDigisacUnread`
2. Badge no sidebar "Conversas"
3. Widget FAB + painel (sem mini-chat inline — navega para a página completa)
4. Suporte a `?thread=<id>` na página `/ops/digisac`
5. Página `/ops/ai` + item no sidebar
6. Commit + push → deploy automático via GitHub Actions
