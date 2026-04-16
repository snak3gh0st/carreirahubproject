# CarreiraUSA AI Copilot — Operations Runbook

**Phase 19 (read-only Q&A) — v1.3 milestone.**

## Environment Variables

| Variable | Purpose | Default | Notes |
|----------|---------|---------|-------|
| `AI_COPILOT_ENABLED` | Master kill switch for `/api/dashboard/ai/*` routes | `false` | Set to `true` to enable. Change takes effect on next request — no redeploy needed if env is updated via Vercel dashboard |
| `AI_RATE_LIMIT_PER_HOUR` | Per-user rolling-window message cap | `50` | Increase cautiously — cost scales linearly |
| `AI_MODEL_DEFAULT` | Default LLM | `gpt-5.2-chat-latest` | Use a project-accessible chat model; legacy `gpt-4o-mini` / `gpt-4-turbo` may return `model_not_found` |
| `OPENAI_API_KEY` | OpenAI API key | required | Shared with existing chatbot service |
| `NEXT_PUBLIC_AI_COPILOT_VISIBLE` | Hide UI without disabling backend | `true` | For testing deployment without exposing to users |

## Kill Switch

**To disable immediately:**
1. Vercel → Project → Settings → Environment Variables
2. Set `AI_COPILOT_ENABLED=false`
3. Redeploy (or trigger a minor config save — Vercel propagates env within seconds)
4. Verify: `curl -X POST https://.../api/dashboard/ai/chat` returns 503

**No deploy required for env change on Vercel — next request reads the new value.**

The kill switch is the FIRST check in the POST handler — before NextAuth session lookup — so disabling it takes effect immediately even for unauthenticated probes.

## Progressive Rollout Plan

Per design spec Section 12:

| Week | Audience | Action |
|------|----------|--------|
| 0 | Production deploy | `AI_COPILOT_ENABLED=false`, verify 503 returned |
| 1 | ADMIN only (Paulo + Fraenze) | Flip `AI_COPILOT_ENABLED=true`. Monitor daily. Collect prompt/response examples for eval suite |
| 2 | + FINANCE + OPERATIONAL + SUPPORT | Announce in team channel. Monitor cost + error rate |
| 3 | + SALES + SDR | Full team rollout |
| 5+ | Phase 20 eligible | If stable 2+ weeks, begin Phase 20 (actions with confirmation) |

## Monitoring

**Daily check** (`/dashboard/ai/admin` — ADMIN only):
- Total messages today < 500 (otherwise investigate usage spike)
- Estimated cost today < $3 (otherwise investigate)
- Recent errors count: if > 5 in an hour, investigate logs

**Weekly check:**
- Top tools: is usage aligned with expected behaviors per role?
- Top users: any outliers (>3x median)?
- 30d cost: trending to < $100/month goal?

## Incident Response

### Symptom: Cost spike
1. Disable via kill switch (`AI_COPILOT_ENABLED=false`)
2. Query: `SELECT userId, COUNT(*) FROM ai_messages WHERE createdAt > NOW() - INTERVAL '24 hours' GROUP BY userId ORDER BY 2 DESC`
3. If one user is the source, investigate their conversations via `/dashboard/ai/admin` recent errors + conversation detail
4. Raise `AI_RATE_LIMIT_PER_HOUR` OR ban user temporarily (no user-ban feature in v1 — disable copilot while investigating)

### Symptom: Rate of tool errors > 5%
1. Check `IntegrationLog` table for QB/DocuSign failures — these propagate into tool errors
2. Check `ai_messages` rows where `errorMessage IS NOT NULL` in last hour
3. If OpenAI 5xx: surface banner in UI stating "AI temporariamente indisponível"
4. If specific tool broken: redeploy with that tool's allowedRoles temporarily emptied

### Symptom: User reports "AI inventou dados"
1. Pull conversation via `/api/dashboard/ai/conversations/[id]`
2. Inspect TOOL messages — did a tool return wrong data or was it fabricated?
3. If fabricated (no tool call in reply): regression in system prompt rule 2 — add to golden-questions suite
4. If wrong tool data: investigate handler logic; fix + add unit test

## Golden Eval Suite

Location: `lib/ai/eval/golden-questions.ts`

**Run manually before deploys that change prompts or tools:**
```bash
# Future: npx tsx lib/ai/eval/run.ts — runs each question against live model, asserts tool calls
# For Phase 19, manual runs: paste each question into /dashboard/ai and verify against assertions
```

Minimum acceptance to ship a prompt change: 14/15 questions pass assertions.

Current questions: 16 across 5 domains (fin-*, stu-*, lead-*, con-*, sec-*, meta-*).

## Data Retention

- `ai_conversations` + `ai_messages`: no auto-deletion in v1. Manual cleanup query if needed:
  ```sql
  DELETE FROM ai_conversations WHERE "createdAt" < NOW() - INTERVAL '6 months';
  -- ai_messages cascade via onDelete: Cascade
  ```
- `ai_rate_limits`: safe to truncate — rebuilds on next request
  ```sql
  TRUNCATE ai_rate_limits;
  ```

## Portal Separation (CRITICAL — from CLAUDE.md)

- AI Copilot lives ONLY in admin portal (`/dashboard/*` + `/api/dashboard/*`)
- **NEVER** import AI code, components, or services into `/hub/*` or `/api/hub/*`
- Middleware enforces `hub-token` cookie for `/hub` and NextAuth session for `/dashboard` — these MUST NOT mix
- If a ChatBubble ever appears on a `/hub` page, revert immediately — it's a portal contamination bug
- Auth check in the route: NextAuth `getServerSession` (not the hub JWT verify function)

## Known Limitations (v1)

- No action execution (Phase 20)
- No RAG / document knowledge (Phase 21)
- No multilingual — PT-BR only
- No mobile-optimized layout (bubble resizes but not redesigned)
- Conversations retained indefinitely (no auto-archive)
- No thumbs up/down feedback loop
- Rate limit uses DB-backed rolling window — if DB is unreachable, the route will error before serving AI responses (fail-safe by design)
