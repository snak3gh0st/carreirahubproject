# Design System

Visual system for Carreira AI Hub. Three surfaces share these tokens: `/dashboard` (admin), `/hub` (cliente), `/ops` (operacional). This document focuses on the **product register** (`/ops` and `/dashboard`). The hub cliente has its own marketing voice.

## Theme

Light primary. Dark mode is opt-in via `class="dark"` on root; ops-night is a future enhancement, not default. Backgrounds tinted toward brand-verde (chroma 0.005-0.01) rather than pure neutral gray.

**Scene sentence (ops):** Operadora da Carreira USA às 8h45 da manhã, no laptop, café na mesa, prestes a entrar na primeira call do dia, precisando saber em 30 segundos quem é prioridade. Light theme, surface morna mas neutra.

## Color

OKLCH where authored, hex preserved where Tailwind tokens already exist.

### Brand palette (canonical)

| Role | Token | Value | Use |
|---|---|---|---|
| Verde institucional | `--brand-verde` | `#2F443F` | Sidebar, headers, marca, ações primárias do ops |
| Tangerina | `--brand-tangerina` | `#FF8142` | Ação requerida, hover ativo, badge "responder" |
| Creme | `--brand-creme` | `#FFF8E8` | Pode aparecer como surface destacada, NÃO como fundo principal do ops (compete com prioridade visual) |
| Café | `--brand-cafe` | `#E1C19B` | Decorativo, divisores destacados |
| Caramelo | `--brand-caramelo` | `#BD925F` | Estados intermediários, contraste sobre verde |

### Verde scale (sidebar + dark surfaces)

50 `#EDF2F1` → 500 `#2F443F` → 900 `#131D1B`. Use 700-900 para sidebar (consistente com atual `bg-brand-verde`), 50-100 para hover state em superfície clara.

### Tangerina scale (ação)

50 `#FFF0E8` (background badges/highlights), 400 `#FF8142` (primary), 600 `#CC5C28` (hover/pressed).

### Color strategy

**Restrained.** O ops é trabalho. Surface 90%+ neutral (cinza tintado em direção ao verde). Brand-verde ocupa sidebar (~12% da tela). Tangerina aparece <10% do tempo, sempre por motivo (ação requerida, hover ativo, número de não-lidos). Vermelho-500 só para erro destrutivo real (nunca para "alerta", use tangerina). Verde-success só para confirmação de transação concluída.

**Não usar:** gradientes em superfícies de UI, color-pop decorativo, paletas pastéis em estados normais.

### Neutrals (tintados em direção ao verde)

Tailwind `gray-*` está conectado a `--gray-*` tokens. Mantém o feel atual (cinzas neutros). Para tintar progressivamente, considerar substituir `gray-50` por `--brand-verde-50` (#EDF2F1) em superfícies onde aparecer próximo ao sidebar verde, para evitar contraste frio.

## Typography

Stack já carregada via next/font:

- **Display:** Blaak (custom, serif-like, alto contraste) → `font-display`. Use para headings principais (h1 nas páginas, marca no sidebar).
- **Sans:** Neue Montreal → `font-sans` default. Body, labels, UI text. Geometric grotesque, peso 400/500/600/700/800.
- **Mono:** JetBrains Mono → `font-mono`. Tabular numbers, código, IDs.

### Scale

Tailwind expõe `text-display | h1 | h2 | h3 | h4 | h5 | h6` via tokens em `--text-*`. Sempre 1.25+ ratio entre steps.

| Token | Use ops |
|---|---|
| `text-display` (Blaak) | Reservado para hub cliente, não usar no ops |
| `text-3xl font-display` ou `text-h1` | Título da página (Pipeline, Conversas, AI) |
| `text-xl font-semibold` | Seções dentro da página |
| `text-base` (16px) | Body, labels de formulário, primeiro nível de info do aluno |
| `text-sm` (14px) | UI elements: botões, nav items, segundo nível |
| `text-xs` (12px) | Meta info: timestamps, badges, "última atualização há 12 min" |
| `text-[11px] font-bold uppercase tracking-wide` | Eyebrow/seção label (já usado no projeto) |

### Hierarchy rules

- Hierarchy via **scale + weight**, não via cor. Cor só para semântica.
- Tabular nums em todos os números operacionais: `tabular-nums` ou via classe Tailwind `font-variant-numeric: tabular-nums`.
- Line-height: `leading-tight` (1.25) em headings, `leading-relaxed` (1.625) em descrições longas, `leading-normal` (1.5) padrão.

## Spacing

4px base (`--space-1` = 4px), seguindo escala existente. Variar densidade por contexto:

| Densidade | Padding | Use |
|---|---|---|
| Compacto (4-8px) | `p-2`, `gap-2` | Inbox lateral, listas longas (Pipeline, Conversas widget) |
| Padrão (12-16px) | `p-3` a `p-4` | Cards de aluno, linhas de tabela |
| Confortável (20-32px) | `p-5` a `p-8` | Top-of-page, primeira tela, hero do dia |
| Generoso (40-64px) | `p-10` a `p-16` | Páginas vazias (empty states), telas marketing |

**Não:** mesmo padding em tudo. O ops perde hierarquia.

## Layout

- Cap content width: `max-w-[1500px]` em páginas amplas (Pipeline, BI), `max-w-4xl` em forms longos.
- Sidebar fixa 256px (`md:pl-64`). Bottom nav mobile com `pb-[max(env(safe-area-inset-bottom),0.5rem)]`.
- **Cards são para agregar informação relacionada, não para decorar.** Linha de aluno no Pipeline é uma `<div>` com border-bottom, não um card. Card é quando há ações dentro.
- Nested cards são proibidos. Se você está colocando card dentro de card, refactore com background tint + border.

## Elevation & Surfaces

| Token | CSS | Use |
|---|---|---|
| Flush | `bg-white` | Surface base sobre `bg-gray-50` |
| Subtle | `shadow-sm border border-gray-200` | Cards de info |
| Raised | `shadow-md` | Dropdowns, popovers |
| Floating | `shadow-2xl` | Modal, painel widget Digisac, FAB |
| Sticky/sidebar | `bg-brand-verde` sem shadow | Navegação fixa |

**Não:** sombras coloridas decorativas (`shadow-purple-500/50` etc.).

## Border radius

`rounded-lg` (8px) padrão. `rounded-xl` (12px) em superfícies grandes (cards de página, painel widget). `rounded-2xl` (16px) só para floating panel. `rounded-full` em FAB, avatars, badges.

## Motion

`prefers-reduced-motion: reduce` desativa todas as transições.

Easings preferidas:

```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
```

| Type | Duration | Easing |
|---|---|---|
| Hover (cor, border) | 120ms | linear |
| Click feedback | 80ms | ease-out |
| Panel slide (widget Digisac) | 220ms | ease-out-expo |
| Page transition | 300ms | ease-out-quart |

**Não:** bounce, elastic, spring overshoot. **Não:** animar `width`, `height`, `top`, `left`. Use `transform` e `opacity`.

## Components (atomic)

### Button

| Variant | Use |
|---|---|
| `primary` | Ação principal: bg-brand-verde, hover bg-brand-verde-700 |
| `accent` | Ação que requer atenção: bg-brand-tangerina, hover bg-brand-tangerina-600 |
| `ghost` | Ações secundárias: text-gray-700 hover:bg-gray-100 |
| `outline` | Ações terciárias: border + text-gray-700 |
| `destructive` | Apagar, voidar: bg-red-600 text-white |

Tamanhos: `sm` (h-9 px-3 text-xs), `md` (h-11 px-4 text-sm), `lg` (h-12 px-6 text-base).

### Badge

Pílulas pequenas, sempre com fundo tintado (não chapado):

```tsx
// Status verde (operacional)
"bg-emerald-50 text-emerald-700 border border-emerald-200"
// Atenção (tangerina)
"bg-orange-50 text-orange-700 border border-orange-200"
// Neutro
"bg-gray-50 text-gray-700 border border-gray-200"
// Crítico
"bg-red-50 text-red-700 border border-red-200"
```

### Input/Form

`h-11`, `rounded-lg`, `border-gray-200`, focus `ring-2 ring-brand-verde/10 border-brand-verde`. Label sempre acima do input. Helper text abaixo, `text-xs text-gray-500`.

### Nav item (sidebar)

Active state: `bg-brand-tangerina text-white shadow-sm`. Hover: `bg-white/10`. Inactive: `text-white/80`. Sempre 44px+ touch area.

## Iconography

Lucide React. 16px (`h-4 w-4`) em meta info, 20px (`h-5 w-5`) em nav e botões, 24px+ em destaques. Cor herdada do contexto (`currentColor`), nunca cor decorativa.

## Density

Ops é uma ferramenta de poder. Densidade alta é virtude. Compare:

| Surface | Linhas visíveis ideal |
|---|---|
| Pipeline (Clientes) | 12-15 alunos sem scroll em 1080p |
| Conversas inbox | 8-10 threads + chat aberto |
| Hoje | 5-7 cards de ação prioritária |
| BI | gráficos grandes, sem clutter |

## Anti-patterns explícitos

1. **Cards iguais em grid 2x2 ou 3x3** com ícone + título + métrica. Substitua por linha-tabular ou hierarquia tipográfica.
2. **Border-left colorida** como acento (`border-l-4 border-orange-500`). Use full border + bg tint.
3. **Gradientes** em qualquer superfície de UI.
4. **Glow / drop-shadow neon** em ícones ou botões.
5. **Modais como primeira reação.** Se cabe inline, faça inline.
6. **Container dentro de container.** Section dentro de card dentro de card.
