---
phase: 18
slug: client-surveys-intake-and-nps-forms
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| TBD | TBD | TBD | TBD | TBD | TBD | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

*Existing infrastructure covers all phase requirements — form system already built.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Intake form auto-assigned on enrollment | TBD | Requires enrollment flow | Create enrollment, verify FormAssignment created |
| NPS survey rendering | TBD | Visual/UX | Open hub form page, verify fields render correctly |
| Ops form panel on student profile | TBD | Cross-portal UX | Navigate ops student profile, verify form section |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
