---
phase: 10
slug: token-font-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification (visual + grep-based) |
| **Config file** | none — design token phase has no test runner |
| **Quick run command** | `npx next build 2>&1 | tail -5` |
| **Full suite command** | `npm run build && npm run lint` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx next build 2>&1 | tail -5`
- **After every plan wave:** Run `npm run build && npm run lint`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 45 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | TKN-01 | grep | `grep 'brand-verde' tailwind.config.ts` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | TKN-01 | grep | `grep '\-\-brand-verde' app/globals.css` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 1 | TKN-02 | grep | `grep 'localFont' lib/fonts.ts` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 1 | TKN-02 | grep | `! grep 'fonts.googleapis.com' app/globals.css` | ✅ | ⬜ pending |
| 10-03-01 | 03 | 1 | TKN-03 | grep | `grep 'font-display' tailwind.config.ts` | ❌ W0 | ⬜ pending |
| 10-04-01 | 04 | 1 | TKN-04 | grep | `grep 'BRAND_COLORS' lib/constants/brand.ts` | ❌ W0 | ⬜ pending |
| 10-04-02 | 04 | 1 | TKN-04 | build | `npm run build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `lib/constants/brand.ts` — brand color hex values as typed constants
- [ ] `lib/fonts.ts` — next/font/local configuration for Blaak + Neue Montreal
- [ ] `public/fonts/` — font files copied from brand kit

*Existing infrastructure covers build validation. No test framework needed for this phase.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Blaak renders in browser headings | TKN-02, TKN-03 | Font rendering requires visual check | Open localhost:3000, inspect h1 computed font-family |
| No FOUT on page load | TKN-02 | Flash of unstyled text is visual | Hard refresh (Cmd+Shift+R), observe font loading |
| Tangerina contrast warning | TKN-04 | Contrast rules are documentation, not code | Verify CONTRAST-RULES.md exists with role assignments |

*Most behaviors have grep-verifiable acceptance criteria in plans.*

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
