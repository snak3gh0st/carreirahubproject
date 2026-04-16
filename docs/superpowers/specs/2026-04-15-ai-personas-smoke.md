# AI Personas — V1 Smoke Test Checklist

**Branch:** `feat/ai-personas`
**Flags:** `AI_PERSONAS_ENABLED=true` + `NEXT_PUBLIC_AI_PERSONAS_ENABLED=true`

## Setup

```bash
# Add to .env.local (temporarily, for testing):
AI_PERSONAS_ENABLED=true
NEXT_PUBLIC_AI_PERSONAS_ENABLED=true

# Then:
npm run dev
```

Open Prisma Studio in a separate terminal for DB inspection:

```bash
npm run db:studio
```

## Happy-path matrix (4 personas × 1 hub each)

For each row, log in with a user whose role maps to the hub, open the hub AI page, and confirm the listed checkpoints.

| # | Hub | Persona | Role needed | URL | Checkpoints |
|---|---|---|---|---|---|
| 1 | admin | **Briefing do Dia** | ADMIN | `/dashboard/admin/ai` | (a) PersonaCard appears on empty state with `Sparkles` icon; (b) clicking runs — assistant streams an analysis; (c) output has **TL;DR / Números / Ação recomendada** sections |
| 2 | financial | **Raio-X Financeiro** | FINANCE | `/dashboard/financial/ai` | (a) PersonaCard with `LineChart` icon; (b) output mentions QB data (receita, caixa, inadimplência); (c) tool calls shown should only be finance tools (no Pipedrive/students) |
| 3 | commercial | **Pulso do Pipeline** | SALES/SDR/COMMERCIAL | `/dashboard/commercial/ai` | (a) PersonaCard with `Activity` icon; (b) output mentions funil/leads/conversão; (c) tool calls only lead-related |
| 4 | operational | **Status da Base** | OPERATIONAL/SUPPORT | `/dashboard/operational/ai` | (a) PersonaCard with `Users` icon; (b) output mentions fases/alunos/SLA; (c) tool calls only student/ops-related |

**Log results here** (fill as you go):

- [ ] #1 admin Briefing do Dia — `PASS / FAIL` ___________
- [ ] #2 financial Raio-X Financeiro — `PASS / FAIL` ___________
- [ ] #3 commercial Pulso do Pipeline — `PASS / FAIL` ___________
- [ ] #4 operational Status da Base — `PASS / FAIL` ___________

## Cache behavior

After completing the happy-path row for `financial`:

- [ ] **Cache hit + delta mode (same user, 2nd click)** — On `/dashboard/financial/ai`, start a NEW conversation and click the chip again. Expected:
  - First click of the NEW conversation: served from cache (should appear ~instantly, not stream from the model). Message badge shows "Cache · {time}".
  - Second click in the same new conversation (click the chip): delta response runs (model call, NOT cache), response says what changed since the previous reading. Badge shows "Live".

- [ ] **Cache hit + different user (first read)** — Log in as a DIFFERENT finance user in incognito, same hub. Click persona. Expected: instant cached response (no stream from model), badge shows "Cache · {time}".
  - In Prisma Studio, check `persona_cache_reads`: should see 2 rows now (one per user) for the same `(persona_slug, day_bucket)`.

- [ ] **Refresh bypass** — Click the "Atualizar" button on an existing persona message. Expected: new model call, NOT served from cache, `persona_cache_entries.generatedAt` updates.

- [ ] **Cache miss → persist** — Wait 3+ hours (or manually DELETE the `persona_cache_entries` row), click persona. Expected: model runs, new row appears in `persona_cache_entries` with current `dayBucket`.

## RBAC and error paths

- [ ] **Wrong hub for persona** — As FINANCE user, craft a POST to `/api/dashboard/ai/chat` with `hub: "financial"` and `personaSlug: "ceo-brief"` (admin-only). Expected: `400` with `"persona não pertence a este hub"`.

- [ ] **Hub RBAC** — As SALES user (commercial), visit `/dashboard/financial/ai`. Expected: blocked by hub guard (pre-existing behavior — not persona-specific).

- [ ] **Unknown persona slug** — POST with `personaSlug: "doesnt-exist"`. Expected: `400` with `"persona desconhecida"`.

- [ ] **Flag off** — Set `AI_PERSONAS_ENABLED=false` and `NEXT_PUBLIC_AI_PERSONAS_ENABLED=false`, restart dev. Expected:
  - PersonaCard and PersonaChip do NOT render anywhere.
  - Free chat works exactly as before.
  - Even if a stale client sends `personaSlug` in the body, server silently ignores it.

## Metadata badge + refresh

- [ ] **Reload persona message persists badge** — Click a persona, wait for response, reload the page. Expected:
  - Persona message re-renders with the badge pill (persona label + Cache/Live tag + Atualizar button).
  - Clicking Atualizar dispatches a fresh generation.

- [ ] **Badge on cross-hub message (edge case)** — Open a conversation from another hub that contains a persona message. Expected:
  - Badge renders (via global `getPersonaBySlug` lookup).
  - Clicking Atualizar falls back to global persona and dispatches (via cross-hub fallback added in T15 polish).

## Output quality spot-checks

For ONE persona response, verify BLUF contract is enforced:

- [ ] `TL;DR` line present with 🟢 / 🟡 / 🔴 color marker
- [ ] `Números` section has at least one KPI with MoM/YoY comparison (or `n/d` if data unavailable)
- [ ] `Ação recomendada` has 1-2 imperative bullets
- [ ] No emoji salad in the body
- [ ] No hallucinated numbers (values reflect what tools actually returned)

## Notes from smoke session

_(Date, tester, observations, anything surprising)_

---
