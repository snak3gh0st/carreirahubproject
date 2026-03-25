# Requirements: Carreira AI Hub — Brand Identity Reskin

**Defined:** 2026-03-25
**Core Value:** Complete Finance workflow automation — seamless integration between QuickBooks and DocuSign to handle invoicing and contracts without manual data entry or lost transactions.

## v1.1 Requirements

Requirements for brand identity reskin. Each maps to roadmap phases.

### Token & Font Foundation

- [ ] **TKN-01**: Design system uses a three-layer CSS custom property architecture (brand primitives, semantic aliases, portal overrides) as single source of truth
- [ ] **TKN-02**: Blaak and Neue Montreal fonts loaded via next/font/local with CSS variable injection, Google Fonts @import removed
- [ ] **TKN-03**: Typography hierarchy defined — Blaak for h1-h3 display headings, Neue Montreal for body/UI text
- [ ] **TKN-04**: Color role rules enforced — Verde as primary text color, Tangerina only on dark surfaces or as non-text accent, contrast ratios verified

### Admin Dashboard

- [ ] **DASH-01**: Sidebar uses Verde (#2F443F) background with Tangerina active states and new brand logo
- [ ] **DASH-02**: Shared components (Button, Card, StatCard, Badge, Input) consume new brand tokens via CSS variables
- [ ] **DASH-03**: All Recharts chart components use brand palette colors (Verde, Tangerina, Cafe com Leite, Caramelo)

### Client Hub

- [ ] **HUB-01**: All hardcoded hex literals and GOLD constants across hub files replaced with token classes
- [ ] **HUB-02**: Hub layout uses Creme surface backgrounds, Verde text, Tangerina accents, brand logo in header
- [ ] **HUB-03**: Login page features Verde + Creme hero treatment with Blaak headline and Tangerina CTA

### Brand Assets & Polish

- [ ] **BRD-01**: Favicon and logo assets replaced across both portals with new Carreira USA brand mark
- [ ] **BRD-02**: Focus rings, status badges, and interactive states updated to brand colors with WCAG AA contrast

## Future Requirements

Deferred to v2+. Tracked but not in current roadmap.

### Dark Mode

- **DARK-01**: Full two-theme token system with dark mode variants for both portals

### Brand Enhancements

- **ENH-01**: Illustrated icon system from brand patterns
- **ENH-02**: Responsive fluid typography (clamp/vw scaling)
- **ENH-03**: Page transition micro-animations
- **ENH-04**: Typographic repeat/pattern backgrounds on login and marketing pages

### Accessibility

- **A11Y-01**: Automated Lighthouse accessibility baseline comparison (pre vs post reskin)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Layout restructuring | v1.1 is a reskin — existing page layouts preserved |
| New pages or routes | No functionality additions in this milestone |
| Dark mode | Requires full two-theme token system — separate milestone |
| Tailwind v4 migration | Incompatible with existing config; separate project |
| New features or functionality | Purely visual milestone |
| Mobile app | Web-only |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TKN-01 | Phase 10 | Pending |
| TKN-02 | Phase 10 | Pending |
| TKN-03 | Phase 10 | Pending |
| TKN-04 | Phase 10 | Pending |
| DASH-01 | Phase 11 | Pending |
| DASH-02 | Phase 11 | Pending |
| HUB-01 | Phase 11 | Pending |
| HUB-02 | Phase 11 | Pending |
| HUB-03 | Phase 11 | Pending |
| BRD-01 | Phase 11 | Pending |
| DASH-03 | Phase 12 | Pending |
| BRD-02 | Phase 12 | Pending |

**Coverage:**
- v1.1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 — traceability mapped to Phases 10-12*
