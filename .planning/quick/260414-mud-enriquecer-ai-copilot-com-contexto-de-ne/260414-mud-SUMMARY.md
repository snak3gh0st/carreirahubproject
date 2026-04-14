---
phase: 260414-mud
plan: 01
subsystem: ai-copilot
tags: [ai, copilot, business-context, ops-workflow, tools]
key-files:
  modified:
    - lib/ai/prompts/system.pt-br.ts
    - lib/ai/tools/meta/explain-data-model.ts
    - lib/ai/tools/index.ts
  created:
    - lib/ai/tools/meta/get-process-guide.ts
decisions:
  - "getProcessGuide reuses OPS_WORKFLOW_DEFINITIONS from lib/ops/workflow.ts — zero data duplication"
  - "Phase keys enumerated manually in z.enum for type safety (not dynamic extraction)"
  - "PROGRAM_CONTEXT string defined inline in get-process-guide.ts (2 sentences, not from workflow.ts which has no such field)"
metrics:
  duration: "~10 min"
  completed: 2026-04-14
  tasks: 2
  files: 4
---

# Quick Task 260414-mud: Enrich AI Copilot with Business Context

**One-liner:** AI Copilot now knows the Carreira USA business (PASS/ADVANCED programs, Brazilian professionals in the USA) and exposes the 11 real operational phases via a new `getProcessGuide` tool that reuses `OPS_WORKFLOW_DEFINITIONS`.

## Changes per File

### lib/ai/prompts/system.pt-br.ts

Added a "Contexto do negócio" block between the role description and the Regras section:

- Identifies Carreira USA as a career mentoring company for Brazilians in the USA
- Names both programs (PASS and ADVANCED) with a one-line purpose
- Describes the target audience (brazilians seeking employment/relocation in US market)
- Lists the 11 operational phases in order and points the model to `getProcessGuide` for phase-level detail

### lib/ai/tools/meta/explain-data-model.ts

Three changes:

1. **`students` entry corrected** — replaced the erroneous "(fases: ex. Bastão, A1, A2, B1, B2, C1, C2, Renovação)" line with the correct 11-phase sequence and an explicit note that A1/A2/B1/B2/C1/C2 are CEFR levels evaluated during the "Teste de Inglês" phase, not program phases.

2. **New `process` entry added** — 11-phase table with one-sentence description per phase, pointing to `getProcessGuide` for full operational detail.

3. **`z.enum` and description updated** — `'process'` added to the entity enum; tool description mentions "processos/fases do programa de mentoria" so the model knows when to call this entry.

### lib/ai/tools/meta/get-process-guide.ts (new)

New tool following the same pattern as `list-capabilities.ts` and `explain-data-model.ts`:

- Imports `OPS_WORKFLOW_DEFINITIONS` from `@/lib/ops/workflow` — all phase data comes from there, nothing is duplicated
- `inputSchema`: optional `phase` parameter, z.enum of the 11 phase keys (`bastao`, `cadastro`, `teste_de_ingles`, `onboarding`, `board`, `bussola`, `raio_x`, `material`, `devolutiva`, `ongoing`, `renovacao`)
- Accessible to ALL_ROLES (same role list as other meta tools)

**Handler behavior:**

| Call | Returns |
|------|---------|
| `getProcessGuide({})` | `{ scope: 'overview', programContext, totalPhases: 11, phases: [{ key, label, shortLabel, description, primaryOwner }] }` |
| `getProcessGuide({ phase: 'bussola' })` | `{ scope: 'phase', programContext, phase: <full OpsWorkflowDefinition> }` |
| `getProcessGuide({ phase: 'invalid' })` | `{ scope: 'phase', programContext, error: 'Fase "invalid" não encontrada...' }` |

**Example response for `phase: 'bussola'`:**
```json
{
  "scope": "phase",
  "programContext": "Carreira USA oferece os programas PASS e ADVANCED — mentoria de colocação profissional (currículo, LinkedIn, entrevistas) para brasileiros buscando emprego ou recolocação no mercado americano.",
  "phase": {
    "key": "bussola",
    "label": "Bússola",
    "shortLabel": "Bússola",
    "description": "Sessão introdutória de direcionamento de carreira",
    "primaryOwner": "Dária Alice",
    "supportOwner": "...",
    "checklist": ["..."],
    "nextActions": ["..."],
    ...
  }
}
```

### lib/ai/tools/index.ts

- Added `import { getProcessGuide } from './meta/get-process-guide';`
- Added `getProcessGuide` to the `toolRegistry` array alongside the other meta tools

## How getProcessGuide Reuses OPS_WORKFLOW_DEFINITIONS (No Duplication)

`OPS_WORKFLOW_DEFINITIONS` is defined once in `lib/ops/workflow.ts` as `export const OPS_WORKFLOW_DEFINITIONS = WORKFLOW_DEFINITIONS`. The new tool imports this array directly and uses `.find()` for phase lookup and `.map()` for the overview. The only data that lives in `get-process-guide.ts` itself is:

1. The `PROGRAM_CONTEXT` string (2 sentences about the business — not available in workflow.ts)
2. The z.enum of phase keys (required for TypeScript type safety at the schema level)

All checklist items, owners, descriptions, SLA, Slack channels, and nextActions are read from `workflow.ts` at runtime.

## Verification Checks Passed

```
grep -c "getProcessGuide" lib/ai/tools/index.ts           → 2  (import + registry)
grep -E "A1, A2.*Renovação" explain-data-model.ts         → 0  (removed)
grep -c "Carreira USA" lib/ai/prompts/system.pt-br.ts     → 2  (role description + context block)
grep -c "bastao|cadastro|onboarding" get-process-guide.ts → 3  (z.enum only, no duplicated descriptions)
npx tsc --noEmit                                          → clean (no errors)
```

## Deviations from Plan

None — plan executed exactly as written.

## Self-Check: PASSED

- `lib/ai/prompts/system.pt-br.ts` — modified, contains "Carreira USA" x2, "PASS", "ADVANCED", "getProcessGuide"
- `lib/ai/tools/meta/explain-data-model.ts` — modified, students entry corrected, 'process' key added to DATA_MODEL_DOCS and z.enum
- `lib/ai/tools/meta/get-process-guide.ts` — created, exports getProcessGuide, imports OPS_WORKFLOW_DEFINITIONS
- `lib/ai/tools/index.ts` — modified, imports and registers getProcessGuide
- Commits: b9289a0 (Task 1), 8a1ddb6 (Task 2)
