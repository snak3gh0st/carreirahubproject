---
phase: 17
slug: daily-action-view-coordinator-overview
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-01
---

# Phase 17 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None (no jest/vitest/pytest installed — consistent with all prior phases) |
| **Config file** | none |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run build` (TypeScript type-check + lint) |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full build must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 17-01-01 | 01 | 0 | DAILY-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 17-01-02 | 01 | 1 | DAILY-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 17-01-03 | 01 | 1 | DAILY-03 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 17-02-01 | 02 | 1 | COORD-01 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 17-02-02 | 02 | 1 | COORD-02 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 17-02-03 | 02 | 1 | COORD-03 | build | `npm run build` | ❌ W0 | ⬜ pending |
| 17-02-04 | 02 | 1 | COORD-04 | build | `npm run build` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- No test infrastructure to create — consistent with all prior phases in this project.
- `npm run build` (TypeScript type-check) is the automated quality gate for all tasks.

*Existing infrastructure (TypeScript + lint) covers all phase requirements for automated checking.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Scoped flag list returns only assigned students | DAILY-01 | No test framework; UI only | Log in as ops user, verify only their enrolled students appear flagged |
| SLA expiry flag fires when ≤2 days remain | DAILY-02 | Date logic requires real enrollment data | Seed enrollment with phase start 5 days ago (7-day SLA), verify flag appears |
| No-session flag fires when last session ≥7 days ago | DAILY-03 | Requires real MentorshipSession data | Create enrollment with last session 8+ days ago, verify amber badge |
| Phase distribution shows correct counts | COORD-01 | UI render verification | Log in as ADMIN, navigate to /ops/coordinator, verify counts match pipeline board |
| Coordinator view unscoped (all students) | COORD-02 | Role-based data scope | Log in as ADMIN, verify all team students appear (not just own) |
| No-session list in coordinator | COORD-03 | Real data required | Verify students with no session in 7+ days appear in coordinator list |
| QB debtors list | COORD-04 | QB balance data in DB | Verify students with qbBalance > 0 appear in debtors section |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
