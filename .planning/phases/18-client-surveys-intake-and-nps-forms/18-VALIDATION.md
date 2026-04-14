---
phase: 18
slug: client-surveys-intake-and-nps-forms
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-03
---

# Phase 18 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest / manual verification |
| **Config file** | none — existing Next.js dev server |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run lint`
- **After every plan wave:** Run `npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 18-01/T1 | 18-01 | 1 | SURV-01 | Automated + manual | `npx tsc --noEmit --pretty 2>&1 | head -30` | yes | ⬜ pending |
| 18-02/T1 | 18-02 | 2 | SURV-02 | Automated + manual | `npx tsc --noEmit --pretty 2>&1 | head -30` | yes | ⬜ pending |
| 18-02/T2 | 18-02 | 2 | SURV-03 | Automated + manual | `npx tsc --noEmit --pretty 2>&1 | head -30` | yes | ⬜ pending |
| 18-03/T1 | 18-03 | 3 | SURV-03, SURV-04 | Automated + manual | `npx tsc --noEmit --pretty 2>&1 | head -30` | yes | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements — form system, auth patterns, and hub submission flow already exist.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Intake form auto-assigned on enrollment | SURV-02 | Requires enrollment flow | Create enrollment, verify the correct onboarding FormAssignment exists and no duplicate pending intake is created |
| NPS survey rendering | SURV-01 | Visual/UX | Open hub form page for `nps-entry` or `nps-exit`, verify localized copy and 0-10 scale render correctly |
| Ops form panel on student profile | SURV-03, SURV-04 | Cross-portal UX | Navigate ops student profile, assign a form, then submit NPS from Hub and verify the profile shows the assignment state and NPS badge |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
