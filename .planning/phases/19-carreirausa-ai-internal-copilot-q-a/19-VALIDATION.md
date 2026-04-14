---
phase: 19
slug: carreirausa-ai-internal-copilot-q-a
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 19 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | node:test (built-in — existing pattern) |
| **Config file** | none — uses `node --test` directly |
| **Quick run command** | `node --test tests/ai/` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/ai/`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 19-01-01 | 01 | 0 | AI-CORE-01 | unit | `node --test tests/ai/tools.test.ts` | ❌ W0 | ⬜ pending |
| 19-01-02 | 01 | 0 | AI-CORE-02 | unit | `node --test tests/ai/rbac.test.ts` | ❌ W0 | ⬜ pending |
| 19-02-01 | 02 | 1 | AI-CORE-03 | unit | `node --test tests/ai/tools.test.ts` | ❌ W0 | ⬜ pending |
| 19-03-01 | 03 | 1 | AI-CORE-04 | integration | `node --test tests/ai/chat-route.test.ts` | ❌ W0 | ⬜ pending |
| 19-04-01 | 04 | 2 | AI-CORE-05 | e2e | manual | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ai/tools.test.ts` — stubs for tool registry and RBAC filtering
- [ ] `tests/ai/rbac.test.ts` — role-based tool access unit tests
- [ ] `tests/ai/chat-route.test.ts` — integration test stubs for chat endpoint
- [ ] `npm install ai@^6.0.159 @ai-sdk/openai@^3.0.53 @ai-sdk/react@^3.0.161` — install AI SDK packages

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chat bubble appears on all /dashboard/* pages | AI-CORE-05 | Requires browser rendering | Open /dashboard, confirm bubble visible bottom-right |
| PT-BR responses from model | AI-CORE-08 | LLM output non-deterministic | Ask "Quantos leads qualificados temos?" — verify PT-BR response |
| Streaming works end-to-end | AI-CORE-04 | SSE stream requires real HTTP | Send message, verify tokens stream in real-time |
| Kill switch disables endpoint | AI-CORE-07 | Env var change requires redeploy or restart | Set AI_COPILOT_ENABLED=false, verify 503 returned |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
