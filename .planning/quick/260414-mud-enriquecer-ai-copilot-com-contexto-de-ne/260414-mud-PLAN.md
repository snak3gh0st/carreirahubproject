---
phase: 260414-mud-enriquecer-ai-copilot-com-contexto-de-ne
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - lib/ai/prompts/system.pt-br.ts
  - lib/ai/tools/meta/explain-data-model.ts
  - lib/ai/tools/meta/get-process-guide.ts
  - lib/ai/tools/index.ts
autonomous: true
requirements: [AI-CTX-01, AI-CTX-02, AI-CTX-03]
must_haves:
  truths:
    - "System prompt explica o que é a Carreira USA, os programas PASS/ADVANCED e o público (brasileiros nos EUA)"
    - "explainDataModel descreve as 11 fases corretas do programa (Bastão → Renovação), sem misturar com níveis CEFR"
    - "AI pode chamar getProcessGuide para explicar uma fase específica ou visão geral das 11 fases"
    - "getProcessGuide reusa as definições de lib/ops/workflow.ts (não duplica dados)"
  artifacts:
    - path: "lib/ai/prompts/system.pt-br.ts"
      provides: "System prompt com contexto de negócio"
      contains: "Carreira USA"
    - path: "lib/ai/tools/meta/explain-data-model.ts"
      provides: "Documentação do modelo incluindo as 11 fases reais"
      contains: "Bastão"
    - path: "lib/ai/tools/meta/get-process-guide.ts"
      provides: "Nova tool getProcessGuide"
      exports: ["getProcessGuide"]
    - path: "lib/ai/tools/index.ts"
      provides: "Registro da nova tool no toolRegistry"
      contains: "getProcessGuide"
  key_links:
    - from: "lib/ai/tools/meta/get-process-guide.ts"
      to: "lib/ops/workflow.ts"
      via: "import { OPS_WORKFLOW_DEFINITIONS }"
      pattern: "OPS_WORKFLOW_DEFINITIONS"
    - from: "lib/ai/tools/index.ts"
      to: "lib/ai/tools/meta/get-process-guide.ts"
      via: "import { getProcessGuide } + registro em toolRegistry"
      pattern: "getProcessGuide"
---

<objective>
Enriquecer o AI Copilot com contexto de negócio da Carreira USA para que ele entenda a empresa, o programa de mentoria e as 11 fases operacionais reais (não CEFR).

Purpose: Hoje o copiloto tem ferramentas de consulta sólidas mas conhecimento de negócio fraco — não sabe explicar o que acontece na fase "Bússola" ou o que é "PASS vs ADVANCED". Isso bloqueia respostas a perguntas conceituais do time.

Output: System prompt enriquecido, explainDataModel com fases corretas, e nova tool getProcessGuide que expõe o workflow operacional ao modelo.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@lib/ai/prompts/system.pt-br.ts
@lib/ai/tools/meta/explain-data-model.ts
@lib/ai/tools/meta/list-capabilities.ts
@lib/ai/tools/_base.ts
@lib/ai/tools/index.ts
@lib/ops/workflow.ts

<interfaces>
<!-- Key types and contracts. Extracted from codebase — executor should use these directly. -->

From lib/ai/tools/_base.ts:
```typescript
export interface AiToolDefinition<TArgs = unknown, TResult = unknown> {
  name: string;
  description: string;
  allowedRoles: UserRole[];
  inputSchema: z.ZodType<TArgs>;
  handler: (args: TArgs, ctx: ToolContext) => Promise<TResult>;
}
export function defineAiTool<TArgs, TResult>(def): AiToolDefinition<TArgs, TResult>;
export function requireRole(actual: UserRole, allowed: UserRole[]): void;
```

From lib/ops/workflow.ts (ALREADY CONTAINS all 11 phases with full metadata):
```typescript
export const OPS_WORKFLOW_DEFINITIONS: OpsWorkflowDefinition[]; // 11 entries
// Phase keys in order: bastao, cadastro, teste_de_ingles, onboarding, board,
//                       bussola, raio_x, material, devolutiva, ongoing, renovacao

export interface OpsWorkflowDefinition {
  key: string;
  label: string;
  shortLabel: string;
  description: string;
  primaryOwner: string;       // ex: "Dária Alice", "Rafael Botelho"
  supportOwner: string;
  clickupFocus: string;
  checklist: string[];
  nextActions: string[];
  requiredRecords: string[];
  communication: string[];
  automations: string[];
  slackChannels: Array<{ name: string; purpose: string }>;
}
```

ALL_ROLES pattern used by other meta tools (list-capabilities, explain-data-model):
```typescript
const ALL_ROLES = [
  UserRole.ADMIN, UserRole.SALES, UserRole.SDR, UserRole.FINANCE,
  UserRole.SUPPORT, UserRole.OPERATIONAL, UserRole.COMMERCIAL,
];
```
</interfaces>

<business_context>
Fases REAIS do programa (11, em ordem):
1. Bastão — Comercial passa para suporte
2. Cadastro — Registro, portal, manual inicial
3. Teste de Inglês — Mônica/Leka avaliam, resultado registrado
4. Onboarding — Links Notion + Trello
5. Board — Aluno monta board Trello (7 dias)
6. Bússola — Sessão introdutória (direcionamento)
7. Raio X — Deep-dive profissional
8. Material — Equipe escreve currículo/cover/LinkedIn (15 dias úteis)
9. Devolutiva — Entrega + sessão 15min com coordenadora
10. Ongoing — Fase Rafael: entrevistas, mock interviews, check-ins quinzenais
11. Renovação — 6 meses: renovar ou finalizar

Equipe: Dária Alice (1-9), Rafael Botelho (10+), Fraenze Werneck (coordenação).
Programas: PASS e ADVANCED. Público: brasileiros buscando emprego nos EUA.
</business_context>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Corrigir explain-data-model.ts e enriquecer system prompt</name>
  <files>lib/ai/prompts/system.pt-br.ts, lib/ai/tools/meta/explain-data-model.ts</files>
  <action>
**Parte A — lib/ai/prompts/system.pt-br.ts:**

Adicionar 3-4 linhas de contexto de negócio logo após a linha 13 (depois da descrição do papel), antes da seção "Regras:". O bloco deve explicar:
- Que a Carreira USA é uma empresa de mentoria de carreira para brasileiros nos EUA
- Os dois programas: PASS e ADVANCED (mentoria de colocação profissional)
- O público: brasileiros buscando emprego ou recolocação nos EUA
- O programa tem 11 fases operacionais (Bastão → Renovação) e que existe a tool `getProcessGuide` para explicá-las

Formato sugerido:
```
Contexto do negócio:
- Carreira USA é uma empresa de mentoria de carreira para brasileiros nos EUA.
- Programas: PASS e ADVANCED — mentoria de colocação profissional (currículo, LinkedIn, entrevistas).
- Clientes: brasileiros buscando emprego ou recolocação no mercado americano.
- O programa de mentoria tem 11 fases operacionais em sequência (Bastão → Cadastro → Teste de Inglês → Onboarding → Board → Bússola → Raio X → Material → Devolutiva → Ongoing → Renovação). Use a tool `getProcessGuide` quando precisar explicar o que acontece em cada fase.
```

Não mexer no resto do prompt. Manter assinatura da função intacta.

**Parte B — lib/ai/tools/meta/explain-data-model.ts:**

1. Corrigir a entrada `students` (linha ~19-26) substituindo a frase errada `(fases: ex. Bastão, A1, A2, B1, B2, C1, C2, Renovação)` pela descrição correta. Nova versão:

```
## Students (Alunos)
- Um **MentorshipEnrollment** representa a matrícula de um cliente no programa (PASS ou ADVANCED).
- Está vinculado a um **Customer** (cliente) — não é uma entidade separada.
- Progride por **MentorshipPhase** em 11 fases sequenciais: Bastão → Cadastro → Teste de Inglês → Onboarding → Board → Bússola → Raio X → Material → Devolutiva → Ongoing → Renovação.
- Importante: A1/A2/B1/B2/C1/C2 são **níveis CEFR** avaliados na fase "Teste de Inglês" — NÃO são fases do programa.
- Cada transição de fase é registrada em **PhaseTransition** (auditoria completa).
- Sessões de mentoria são registradas em **MentorshipSession**.
- Para detalhes operacionais de cada fase (checklist, responsável, SLA), use a tool `getProcessGuide`.
```

2. Adicionar nova entrada `process` ao `DATA_MODEL_DOCS` com visão geral resumida das 11 fases (só labels + 1 frase cada) e aviso de que `getProcessGuide` traz o detalhamento.

3. Atualizar o `z.enum` do `inputSchema` incluindo `'process'` nas opções.

4. Atualizar a descrição da tool para mencionar que ela também cobre "processos/fases do programa de mentoria".

Referência direta: per problema diagnosticado na linha 23 do arquivo atual (fases misturadas com CEFR).
  </action>
  <verify>
    <automated>npx tsc --noEmit lib/ai/prompts/system.pt-br.ts lib/ai/tools/meta/explain-data-model.ts</automated>
  </verify>
  <done>
- system.pt-br.ts contém "Carreira USA", "PASS", "ADVANCED" e menciona `getProcessGuide`.
- explain-data-model.ts: entrada `students` não contém mais "A1, A2, B1, B2, C1, C2" como fases; contém "Bastão → Cadastro → ... → Renovação".
- Nova key `process` existe em DATA_MODEL_DOCS e no z.enum do inputSchema.
- `npx tsc --noEmit` passa sem erros nos arquivos modificados.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Criar tool getProcessGuide e registrar no toolRegistry</name>
  <files>lib/ai/tools/meta/get-process-guide.ts, lib/ai/tools/index.ts</files>
  <action>
**Parte A — Criar lib/ai/tools/meta/get-process-guide.ts:**

Seguir o padrão de `list-capabilities.ts` e `explain-data-model.ts`:
- Importar `z`, `UserRole`, `defineAiTool`, `requireRole` do `../_base`
- Importar `OPS_WORKFLOW_DEFINITIONS` de `@/lib/ops/workflow` (é o array com as 11 fases já definidas — reusar, NÃO duplicar)
- Usar o mesmo `ALL_ROLES` que as outras tools meta
- `inputSchema`: objeto com parâmetro opcional `phase` que é um `z.enum` com as 11 keys: `'bastao' | 'cadastro' | 'teste_de_ingles' | 'onboarding' | 'board' | 'bussola' | 'raio_x' | 'material' | 'devolutiva' | 'ongoing' | 'renovacao'`. Extrair as keys dinamicamente de `OPS_WORKFLOW_DEFINITIONS.map(d => d.key)` usando `z.enum([...] as [string, ...string[]])` ou enumerar manualmente (preferir enumeração manual para segurança de tipos).

Comportamento do handler:
- Se `phase` fornecida: retornar o objeto completo `OpsWorkflowDefinition` correspondente (campos: key, label, shortLabel, description, primaryOwner, supportOwner, checklist, nextActions, requiredRecords, communication, automations, clickupFocus, slackChannels). Se não encontrar, retornar erro amigável.
- Se `phase` omitida: retornar visão geral com array de `{ key, label, shortLabel, description, primaryOwner }` das 11 fases em ordem + campo `totalPhases: 11` + nota explicativa sobre o programa.

Retorno geral deve ter shape:
```typescript
{
  scope: 'overview' | 'phase',
  programContext: string,  // 1-2 frases sobre Carreira USA / PASS / ADVANCED
  phase?: OpsWorkflowDefinition,  // quando scope === 'phase'
  phases?: Array<{ key, label, shortLabel, description, primaryOwner }>,  // quando scope === 'overview'
  totalPhases?: number,
}
```

`name`: `'getProcessGuide'`
`description`: algo como "Explica o processo operacional da mentoria Carreira USA: as 11 fases do programa (Bastão → Renovação), o que acontece em cada uma, responsáveis, checklist e próximas ações. Use quando o usuário perguntar sobre processos, fases, o que acontece em 'Bussola'/'Raio X'/etc, ou quem é responsável por qual etapa."

**Parte B — Registrar em lib/ai/tools/index.ts:**

- Adicionar `import { getProcessGuide } from './meta/get-process-guide';` junto com os outros imports de `meta/`
- Incluir `getProcessGuide` no array `toolRegistry`, na mesma linha das outras tools meta (linha ~38).

Usar Edit tool para modificações pontuais. NÃO reescrever o arquivo inteiro.
  </action>
  <verify>
    <automated>npx tsc --noEmit && node -e "const r = require('./lib/ai/tools/index.ts'); console.log(r.toolRegistry.map(t => t.name))" 2>&1 | grep -c getProcessGuide</automated>
  </verify>
  <done>
- Arquivo `lib/ai/tools/meta/get-process-guide.ts` existe, exporta `getProcessGuide`, importa `OPS_WORKFLOW_DEFINITIONS` de `@/lib/ops/workflow` (sem duplicar as definições das fases).
- `lib/ai/tools/index.ts` importa e registra `getProcessGuide` no `toolRegistry`.
- `npx tsc --noEmit` passa sem erros.
- Chamar `getProcessGuide({})` retorna visão geral das 11 fases; chamar `getProcessGuide({ phase: 'bussola' })` retorna o objeto completo daquela fase com primaryOwner e checklist.
  </done>
</task>

</tasks>

<verification>
**Integração manual rápida** (executor confirma após Task 2):

```bash
# 1. TypeScript limpo
npx tsc --noEmit

# 2. Tool registrada
grep -c "getProcessGuide" lib/ai/tools/index.ts  # esperado: 2 (import + registry)

# 3. Fases CEFR removidas do texto errado
grep -E "A1, A2, B1, B2, C1, C2.*Renovação" lib/ai/tools/meta/explain-data-model.ts  # esperado: vazio

# 4. Contexto no system prompt
grep -c "Carreira USA" lib/ai/prompts/system.pt-br.ts  # esperado: >= 2

# 5. Reuso (sem duplicação)
grep -c "bastao\|cadastro\|onboarding" lib/ai/tools/meta/get-process-guide.ts
# Esperado: apenas no z.enum (keys), NÃO descrições completas — estas vêm de workflow.ts
```

Smoke test no chat: abrir `/dashboard` → AI Copilot → perguntar "o que acontece na fase Bússola?" → AI deve chamar `getProcessGuide` e retornar checklist/responsável corretos.
</verification>

<success_criteria>
- [ ] System prompt contém contexto de negócio (Carreira USA, PASS/ADVANCED, público brasileiro nos EUA)
- [ ] `explainDataModel` descreve as 11 fases corretas e diferencia fases de níveis CEFR
- [ ] Tool `getProcessGuide` existe, está registrada e reusa `OPS_WORKFLOW_DEFINITIONS`
- [ ] Sem duplicação de dados entre `lib/ops/workflow.ts` e `get-process-guide.ts`
- [ ] Build TypeScript limpo
- [ ] Pergunta "o que acontece na fase Bússola?" retorna resposta correta via tool
</success_criteria>

<output>
After completion, create `.planning/quick/260414-mud-enriquecer-ai-copilot-com-contexto-de-ne/260414-mud-SUMMARY.md` documentando:
- Mudanças feitas em cada arquivo
- Como a tool reusa `OPS_WORKFLOW_DEFINITIONS` (não duplica)
- Exemplo de chamada e resposta de `getProcessGuide`
</output>
