---
phase: 260414-ncs
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - app/api/dashboard/ai/chat/route.ts
  - lib/ai/tools/finance/get-quickbooks-report.ts
  - .env.local
  - components/ai/MessageList.tsx
  - components/ai/ToolCallCard.tsx
autonomous: true
requirements:
  - CTX-01 (fix context_length_exceeded: truncate history + summarize QB report + use gpt-4o)
  - UX-01 (rich loading states showing which tool is being consulted)
  - UX-02 (ToolCallCard with friendly labels and icons)

must_haves:
  truths:
    - "Chat com QB P&L não estoura contexto após 5+ trocas"
    - "Modelo usado é gpt-4o (128K context window), não gpt-4"
    - "Tool getQuickBooksReport retorna resumo estruturado (~300 tokens) em vez de JSON bruto de ~50KB"
    - "Usuário vê 'Pesquisando QuickBooks...' enquanto tool executa, não 'Pensando...' genérico"
    - "ToolCallCard mostra label amigável (ex: 'QuickBooks') + ícone, com nome técnico em subtext"
  artifacts:
    - path: "app/api/dashboard/ai/chat/route.ts"
      provides: "Histórico truncado para últimas 20 mensagens antes do convertToModelMessages"
      contains: "slice(-20)"
    - path: "lib/ai/tools/finance/get-quickbooks-report.ts"
      provides: "summarizeQbReport(report) extraindo income_total, expenses_total, net_income, top_expenses, period"
      contains: "summarizeQbReport"
    - path: ".env.local"
      provides: "AI_MODEL_DEFAULT=gpt-4o"
      contains: "AI_MODEL_DEFAULT=gpt-4o"
    - path: "components/ai/MessageList.tsx"
      provides: "Loading state inteligente: 'Pesquisando [label]...' durante tool call vs 'Escrevendo resposta...' durante texto"
      contains: "Pesquisando"
    - path: "components/ai/ToolCallCard.tsx"
      provides: "Label amigável + ícone Lucide por toolName, badge Concluído, spinner in-flight"
      contains: "TOOL_META"
  key_links:
    - from: "app/api/dashboard/ai/chat/route.ts"
      to: "messages array"
      via: "messages.slice(-20)"
      pattern: "slice\\(-20\\)"
    - from: "lib/ai/tools/finance/get-quickbooks-report.ts"
      to: "model response"
      via: "summarizeQbReport em vez de truncateJson(report)"
      pattern: "summarizeQbReport"
    - from: "components/ai/MessageList.tsx"
      to: "tool name → label PT-BR"
      via: "map de TOOL_LABELS"
      pattern: "TOOL_LABELS|tool-"
---

<objective>
Corrigir `context_length_exceeded` no AI Copilot e melhorar UX de loading.

Purpose: AI Copilot quebra após 5-6 trocas com QB reports porque (1) está usando gpt-4 (8K window), (2) QB P&L retorna JSON bruto de ~50KB, (3) histórico nunca é truncado. Além disso, UX mostra "Pensando..." genérico sem indicar qual tool está executando.

Output:
- Backend: histórico truncado para últimas 20 msgs + resumo estruturado do QB P&L (~300 tokens em vez de ~5000)
- Env: AI_MODEL_DEFAULT=gpt-4o
- Frontend: MessageList mostra "Pesquisando [tool PT-BR]..." durante tool call; ToolCallCard com label amigável + ícone Lucide + estado (in-flight/concluído)
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@app/api/dashboard/ai/chat/route.ts
@lib/ai/tools/finance/get-quickbooks-report.ts
@lib/ai/dto/index.ts
@components/ai/MessageList.tsx
@components/ai/ToolCallCard.tsx
@components/ai/ChatPanel.tsx

<interfaces>
<!-- Contratos que os executores precisam conhecer -->

Estrutura atual do tool result em `app/api/dashboard/ai/chat/route.ts` (linhas 126-131):
```typescript
const modelMessages = await convertToModelMessages(messages);
const result = streamText({
  model,
  system: systemPrompt,
  messages: modelMessages,
  tools: aiSdkTools,
  stopWhen: stepCountIs(8),
  onFinish: async ({ usage, text, finishReason, steps }) => { ... }
});
```

Retorno atual do `getQuickBooksReport` (linhas 55-62):
```typescript
return {
  reportType,
  startDate,
  endDate,
  report: truncateJson(report),  // ← JSON bruto cortado em 10KB
  fetchedAt: new Date().toISOString(),
  latencyMs: Date.now() - started,
};
```

Estrutura do QB P&L retornado por `quickbooksService.getProfitAndLossReport`:
```json
{
  "Header": { "StartPeriod": "2025-01-01", "EndPeriod": "2025-01-31", "Currency": "USD" },
  "Rows": {
    "Row": [
      {
        "type": "Section",
        "group": "Income",
        "Header": { "ColData": [{"value": "Income"}] },
        "Rows": { "Row": [
          { "type": "Data", "ColData": [{"value": "Tuition"}, {"value": "30000.00"}] }
        ]},
        "Summary": { "ColData": [{"value": "Total Income"}, {"value": "50000.00"}] }
      },
      {
        "type": "Section",
        "group": "Expenses",
        "Rows": { "Row": [
          { "type": "Data", "ColData": [{"value": "Salaries"}, {"value": "12000.00"}] },
          { "type": "Data", "ColData": [{"value": "Rent"}, {"value": "3000.00"}] }
        ]},
        "Summary": { "ColData": [{"value": "Total Expenses"}, {"value": "25000.00"}] }
      },
      {
        "type": "Section",
        "group": "NetIncome",
        "Summary": { "ColData": [{"value": "Net Income"}, {"value": "25000.00"}] }
      }
    ]
  }
}
```

MessageList tool part shape (AI SDK v6, UIMessage):
```typescript
// p.type is e.g. 'tool-getQuickBooksReport' or 'tool-invocation'
// p.toolName: string (e.g. 'getQuickBooksReport')
// p.state: 'call' | 'result' (when tool-invocation style)
// p.output / p.result: unknown (undefined while in-flight)
// p.input / p.args: unknown
```

Conjunto completo de toolNames usados no sistema (de `allowedToolsForRole`):
- Finance: `getQuickBooksReport`, `getOverdueInvoices`
- Leads: `getLeadsByStatus`, `getLeadsBySource`, `getLeadQualification`
- Students: `getStudentsByPhase`, `getStudentProfile`, `getStudentSessions`, `getStudentNextActions`
- Contracts: `getContracts`, `getDocumentStatus`
- Ops: `getCoordinatorOverview`, `getDailyActionView`
- Search: `searchStudents`, `searchCustomers`
- Meta: `getProcessGuide`, `explainDataModel`, `listCapabilities`
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Backend — truncar histórico e resumir QB report</name>
  <files>app/api/dashboard/ai/chat/route.ts, lib/ai/tools/finance/get-quickbooks-report.ts</files>
  <action>
    **Parte A — `app/api/dashboard/ai/chat/route.ts`:**
    Na linha 126, antes de `convertToModelMessages(messages)`, truncar para as últimas 20 mensagens:
    ```typescript
    const recentMessages = messages.slice(-20);
    const modelMessages = await convertToModelMessages(recentMessages);
    ```
    Usar `modelMessages` no `streamText` (como já está). Isto garante que mesmo após conversas longas o contexto não cresce indefinidamente.

    **Parte B — `lib/ai/tools/finance/get-quickbooks-report.ts`:**
    Adicionar função `summarizeQbReport(report: unknown, reportType: ReportType): unknown` ANTES do `export const getQuickBooksReport`:

    ```typescript
    type QbRow = {
      type?: string;
      group?: string;
      ColData?: Array<{ value?: string }>;
      Summary?: { ColData?: Array<{ value?: string }> };
      Rows?: { Row?: QbRow[] };
    };

    function parseAmount(v?: string): number {
      if (!v) return 0;
      const n = Number(String(v).replace(/[,\s]/g, ''));
      return Number.isFinite(n) ? n : 0;
    }

    function flattenExpenseRows(rows: QbRow[] | undefined): Array<{ name: string; amount: number }> {
      if (!rows) return [];
      const out: Array<{ name: string; amount: number }> = [];
      for (const r of rows) {
        if (r.type === 'Data' && r.ColData && r.ColData.length >= 2) {
          const name = r.ColData[0]?.value ?? '(sem nome)';
          const amount = parseAmount(r.ColData[r.ColData.length - 1]?.value);
          if (amount !== 0) out.push({ name, amount });
        }
        if (r.Rows?.Row) out.push(...flattenExpenseRows(r.Rows.Row));
      }
      return out;
    }

    function summarizeQbReport(report: unknown, reportType: ReportType): unknown {
      if (reportType !== 'profit_and_loss') {
        // Para outros reports, fallback: truncateJson mais agressivo (~3KB)
        return truncateJson(report, 3_000);
      }
      try {
        const r = report as { Header?: { StartPeriod?: string; EndPeriod?: string; Currency?: string }; Rows?: { Row?: QbRow[] } };
        const topRows = r?.Rows?.Row ?? [];
        let incomeTotal = 0;
        let expensesTotal = 0;
        let netIncome = 0;
        let topExpenses: Array<{ name: string; amount: number }> = [];

        for (const section of topRows) {
          if (section.type !== 'Section') continue;
          const summaryAmount = parseAmount(section.Summary?.ColData?.[section.Summary.ColData.length - 1]?.value);
          const group = (section.group ?? '').toLowerCase();
          const headerLabel = section.Summary?.ColData?.[0]?.value?.toLowerCase() ?? '';
          if (group === 'income' || headerLabel.includes('total income') || headerLabel.includes('total revenue')) {
            incomeTotal = summaryAmount;
          } else if (group === 'expenses' || headerLabel.includes('total expenses')) {
            expensesTotal = summaryAmount;
            topExpenses = flattenExpenseRows(section.Rows?.Row)
              .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
              .slice(0, 10);
          } else if (group === 'netincome' || headerLabel.includes('net income')) {
            netIncome = summaryAmount;
          }
        }
        if (netIncome === 0 && (incomeTotal || expensesTotal)) {
          netIncome = incomeTotal - expensesTotal;
        }
        return {
          period: {
            start: r?.Header?.StartPeriod ?? null,
            end: r?.Header?.EndPeriod ?? null,
          },
          currency: r?.Header?.Currency ?? 'USD',
          income_total: incomeTotal,
          expenses_total: expensesTotal,
          net_income: netIncome,
          top_expenses: topExpenses,
        };
      } catch (err) {
        // Se o parse falhar, cair para truncateJson conservador
        return { __parse_error: (err as Error).message, fallback: truncateJson(report, 3_000) };
      }
    }
    ```

    No `return` do handler (linhas 55-62), trocar `report: truncateJson(report)` por `summary: summarizeQbReport(report, reportType)`:
    ```typescript
    return {
      reportType,
      startDate,
      endDate,
      summary: summarizeQbReport(report, reportType),
      fetchedAt: new Date().toISOString(),
      latencyMs: Date.now() - started,
    };
    ```

    Manter `truncateJson(report)` no `IntegrationLog` payload (linha 52) — logging best-effort.

    **Razão:** `messages.slice(-20)` é cap duro e barato. `summarizeQbReport` entrega ao modelo os números que ele precisa (~300 tokens) em vez de JSON bruto (~5000 tokens), eliminando a causa principal do overflow. Reports não-P&L usam truncateJson mais agressivo (3KB) como medida intermediária.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
    - `app/api/dashboard/ai/chat/route.ts` contém `messages.slice(-20)` antes do `convertToModelMessages`
    - `lib/ai/tools/finance/get-quickbooks-report.ts` exporta/usa `summarizeQbReport`
    - Tool handler retorna `{ summary: {...} }` (não `report: truncateJson(...)`) para P&L
    - `npx tsc --noEmit` passa sem erros
  </done>
</task>

<task type="auto">
  <name>Task 2: Env — trocar modelo default para gpt-4o</name>
  <files>.env.local</files>
  <action>
    Editar `.env.local` linha 92: mudar `AI_MODEL_DEFAULT=gpt-4` para `AI_MODEL_DEFAULT=gpt-4o`.

    Se a linha já estiver correta (`gpt-4o`), apenas documentar no SUMMARY que nenhuma mudança foi necessária.

    **Razão:** `gpt-4` tem janela de 8K tokens; `gpt-4o` tem 128K e é ~3x mais barato. A causa raiz do `context_length_exceeded` é o modelo errado. O código (`app/api/dashboard/ai/chat/route.ts` linha 119) já lê `process.env.AI_MODEL_DEFAULT` com fallback `'gpt-4o-mini'`, então basta trocar o env var — nenhuma mudança de código necessária.

    **Nota:** Este arquivo NÃO é commitado (está no `.gitignore`). O executor deve lembrar o usuário no SUMMARY que essa mesma mudança precisa ser feita em staging/production via Vercel env vars.
  </action>
  <verify>
    <automated>grep -E "^AI_MODEL_DEFAULT=gpt-4o$" .env.local</automated>
  </verify>
  <done>
    - `.env.local` contém exatamente `AI_MODEL_DEFAULT=gpt-4o` (sem `-mini`, sem `gpt-4` puro)
    - SUMMARY menciona necessidade de atualizar env var na Vercel
  </done>
</task>

<task type="auto">
  <name>Task 3: UX — loading states ricos + ToolCallCard melhorado</name>
  <files>components/ai/MessageList.tsx, components/ai/ToolCallCard.tsx</files>
  <action>
    **Parte A — `components/ai/ToolCallCard.tsx` (rewrite completo):**

    Criar map de metadata de tool (label PT-BR + ícone Lucide):
    ```typescript
    'use client';
    import { useState } from 'react';
    import {
      ChevronRight, Wrench, DollarSign, Users, GraduationCap,
      FileText, Search, Info, LayoutDashboard, Loader2, CheckCircle2
    } from 'lucide-react';

    type ToolMeta = { label: string; Icon: React.ComponentType<{ className?: string }> };

    const TOOL_META: Record<string, ToolMeta> = {
      getQuickBooksReport:    { label: 'QuickBooks',          Icon: DollarSign },
      getOverdueInvoices:     { label: 'Faturas vencidas',    Icon: DollarSign },
      getLeadsByStatus:       { label: 'Leads',               Icon: Users },
      getLeadsBySource:       { label: 'Leads',               Icon: Users },
      getLeadQualification:   { label: 'Leads',               Icon: Users },
      getStudentsByPhase:     { label: 'Alunos',              Icon: GraduationCap },
      getStudentProfile:      { label: 'Aluno',               Icon: GraduationCap },
      getStudentSessions:     { label: 'Sessões do aluno',    Icon: GraduationCap },
      getStudentNextActions:  { label: 'Próximas ações',      Icon: GraduationCap },
      getContracts:           { label: 'Contratos',           Icon: FileText },
      getDocumentStatus:      { label: 'Contratos',           Icon: FileText },
      getCoordinatorOverview: { label: 'Visão operacional',   Icon: LayoutDashboard },
      getDailyActionView:     { label: 'Visão do dia',        Icon: LayoutDashboard },
      searchStudents:         { label: 'Busca de alunos',     Icon: Search },
      searchCustomers:        { label: 'Busca de clientes',   Icon: Search },
      getProcessGuide:        { label: 'Documentação',        Icon: Info },
      explainDataModel:       { label: 'Documentação',        Icon: Info },
      listCapabilities:       { label: 'Capacidades',         Icon: Info },
    };

    function resolveToolMeta(toolName: string): ToolMeta {
      // toolName pode vir como 'getQuickBooksReport' ou 'tool-getQuickBooksReport'
      const clean = toolName.replace(/^tool-/, '');
      return TOOL_META[clean] ?? { label: clean, Icon: Wrench };
    }

    export function ToolCallCard({
      toolName, args, result,
    }: { toolName: string; args?: unknown; result?: unknown }) {
      const [open, setOpen] = useState(false);
      const { label, Icon } = resolveToolMeta(toolName);
      const inFlight = result === undefined;
      const clean = toolName.replace(/^tool-/, '');

      return (
        <div className="my-2 text-xs border border-border rounded-lg bg-muted/30">
          <button
            onClick={() => setOpen(v => !v)}
            className="w-full px-3 py-2 flex items-center gap-2 hover:bg-muted/50 text-left"
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="font-medium truncate">{label}</span>
              <span className="font-mono text-[10px] text-muted-foreground truncate">{clean}</span>
            </div>
            {inFlight ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-green-600 dark:text-green-500 flex-shrink-0">
                <CheckCircle2 className="w-3 h-3" />
                Concluído
              </span>
            )}
            <ChevronRight className={`w-3 h-3 ml-1 transition flex-shrink-0 ${open ? 'rotate-90' : ''}`} />
          </button>
          {open && (
            <div className="px-3 py-2 border-t border-border space-y-2">
              <div>
                <div className="text-muted-foreground mb-1">Argumentos:</div>
                <pre className="whitespace-pre-wrap bg-background p-2 rounded">{JSON.stringify(args ?? {}, null, 2)}</pre>
              </div>
              {result !== undefined && (
                <div>
                  <div className="text-muted-foreground mb-1">Resultado:</div>
                  <pre className="whitespace-pre-wrap bg-background p-2 rounded max-h-60 overflow-auto">{JSON.stringify(result, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    // Export metadata for reuse by MessageList
    export { TOOL_META, resolveToolMeta };
    ```

    **Parte B — `components/ai/MessageList.tsx`:**

    Substituir a linha 45 (`{isStreaming && <div ...>Pensando...</div>}`) por lógica que inspeciona a última mensagem assistant para detectar tool call em andamento:

    ```typescript
    'use client';
    import { MessageBubble } from './MessageBubble';
    import { ToolCallCard, resolveToolMeta } from './ToolCallCard';
    import { useEffect, useRef } from 'react';
    import { Loader2 } from 'lucide-react';

    function detectInFlightTool(messages: any[]): string | null {
      // Olha apenas a última mensagem assistant
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        if (m.role !== 'assistant') continue;
        const parts = m.parts ?? [];
        // Busca a última part tool-* sem output/result (in-flight)
        for (let j = parts.length - 1; j >= 0; j--) {
          const p = parts[j];
          const type = typeof p.type === 'string' ? p.type : '';
          const isTool = type.startsWith('tool-') || type === 'tool-invocation' || type === 'tool-call';
          if (!isTool) continue;
          const hasResult = p.output !== undefined || p.result !== undefined || p.state === 'result';
          if (!hasResult) {
            return p.toolName ?? type.replace(/^tool-/, '');
          }
        }
        break; // só checa a última assistant message
      }
      return null;
    }

    export function MessageList({
      messages, isStreaming, onDeleteMessage,
    }: {
      messages: any[];
      isStreaming: boolean;
      onDeleteMessage?: (messageId: string) => void;
    }) {
      const endRef = useRef<HTMLDivElement>(null);
      useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isStreaming]);

      const inFlightTool = isStreaming ? detectInFlightTool(messages) : null;
      const loadingLabel = inFlightTool
        ? `Pesquisando ${resolveToolMeta(inFlightTool).label.toLowerCase()}...`
        : 'Escrevendo resposta...';

      return (
        <div className="flex-1 overflow-y-auto p-4">
          {messages.map(m => {
            const parts = m.parts ?? [{ type: 'text', text: typeof m.content === 'string' ? m.content : '' }];
            return (
              <div key={m.id}>
                {parts.map((p: any, idx: number) => {
                  if (p.type === 'text' && p.text) {
                    return (
                      <MessageBubble
                        key={idx}
                        role={m.role === 'assistant' ? 'assistant' : 'user'}
                        content={p.text}
                        onDelete={onDeleteMessage ? () => onDeleteMessage(m.id) : undefined}
                      />
                    );
                  }
                  if (typeof p.type === 'string' && p.type.startsWith('tool-')) {
                    return (
                      <ToolCallCard
                        key={idx}
                        toolName={p.toolName ?? p.type}
                        args={p.input ?? p.args}
                        result={p.output ?? p.result}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            );
          })}
          {isStreaming && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground italic mt-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{loadingLabel}</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      );
    }
    ```

    **Razão:** `detectInFlightTool` olha a última mensagem assistant e procura tool parts sem result — exatamente o estado em que a UI precisa comunicar "estou consultando X". Fallback `'Escrevendo resposta...'` cobre streaming de texto puro. Compartilhar `TOOL_META` entre MessageList e ToolCallCard via export garante consistência de labels.
  </action>
  <verify>
    <automated>npx tsc --noEmit &amp;&amp; npm run lint -- --quiet components/ai/MessageList.tsx components/ai/ToolCallCard.tsx</automated>
  </verify>
  <done>
    - `ToolCallCard.tsx` exporta `TOOL_META` e `resolveToolMeta`; renderiza label amigável + ícone + badge Concluído/spinner
    - `MessageList.tsx` chama `detectInFlightTool` e mostra "Pesquisando [label]..." quando tool está executando, "Escrevendo resposta..." caso contrário
    - Ambos arquivos: `npx tsc --noEmit` passa, `npm run lint` não reporta erros novos
    - Funcionalidade expandir/colapsar do ToolCallCard continua funcionando
  </done>
</task>

</tasks>

<verification>
1. `npx tsc --noEmit` passa sem erros de tipos em todos os arquivos modificados
2. `grep AI_MODEL_DEFAULT .env.local` retorna `AI_MODEL_DEFAULT=gpt-4o`
3. Teste manual (checkpoint de sanidade do usuário pós-execução):
   - Abrir `/dashboard`, abrir AI Copilot
   - Perguntar "Qual foi o resultado financeiro do mês passado?" (aciona `getQuickBooksReport`)
   - Verificar que aparece "Pesquisando QuickBooks..." com spinner enquanto executa
   - Verificar que ToolCallCard mostra "QuickBooks" com ícone DollarSign e badge "Concluído"
   - Enviar 6-7 perguntas adicionais sobre QB — não deve dar `context_length_exceeded`
   - Abrir o ToolCallCard: resultado deve ser compacto (income_total, expenses_total, net_income, top_expenses) em vez de JSON bruto
</verification>

<success_criteria>
- Causa 1 (modelo) resolvida: `.env.local` tem `AI_MODEL_DEFAULT=gpt-4o`
- Causa 2 (QB JSON gigante) resolvida: `summarizeQbReport` substitui `truncateJson(report)` no retorno do tool
- Causa 3 (histórico sem limite) resolvida: `messages.slice(-20)` aplicado antes de `convertToModelMessages`
- UX melhorada: `MessageList` mostra label contextual da tool em execução
- UX melhorada: `ToolCallCard` mostra label amigável PT-BR + ícone Lucide + badge de estado
- Tipos passam (`npx tsc --noEmit`)
</success_criteria>

<output>
After completion, create `.planning/quick/260414-ncs-fix-ai-context-overflow-ux-de-loading-re/260414-ncs-SUMMARY.md` documentando:
- Que mudanças foram feitas em cada arquivo
- Lembrete de atualizar `AI_MODEL_DEFAULT=gpt-4o` na Vercel (staging + production)
- Antes/depois do tamanho aproximado do payload QB (de ~5000 tokens → ~300 tokens)
- Screenshot/descrição dos novos loading states se possível
</output>
