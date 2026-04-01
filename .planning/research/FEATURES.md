# Feature Research

**Domain:** Student journey management ops workspace — internal team tool for coaching/mentorship program delivery
**Researched:** 2026-04-01
**Confidence:** HIGH (pipeline patterns, session logging, profile views) / MEDIUM (daily task queue specifics from coaching CRM patterns)

---

## Context: What This Is and Is Not

This is an internal ops tool for a 3-person team (Fraenze, Dária, Rafael) replacing ClickUp as their operational hub. It is **not** a product for students — students have the Client Hub already. The research question is: what do coaching CRMs, mentorship platforms, and CS ops tools (CoachVantage, HubSpot CS Workspace, Gainsight, Vitally, Totango) actually implement in the four target areas, and which of those features are load-bearing vs. nice-to-have for a small team managing a fixed 11-phase journey?

### Existing Foundation (Do Not Re-Build)

| Already Built | Where |
|---------------|-------|
| Customer records (contact info, QB IDs, Pipedrive IDs) | `lib/services/identity-mapper.ts`, `Customer` model |
| English test results | `app/dashboard/tests/`, `Test` model |
| Invoice / payment status | QuickBooks sync, `Invoice` model |
| Client Hub (student-facing portal) | `app/hub/` |
| Auth / RBAC with team roles | `lib/auth.ts`, `User` model |
| Ops portal skeleton (layout, login, customers placeholder) | `app/ops/` |

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features the team assumes will exist. Missing any of these produces a tool that cannot replace ClickUp for daily operations.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Phase pipeline board** — all active students in a single board view, one column per phase | Every coaching CRM (HubSpot, CoachVantage, Vitally) surfaces a pipeline board as the primary entry point. Teams expect to see "who is in what phase" at a glance without querying | MEDIUM | 11 columns (Bastão → Renovação/Saída). Card shows student name, program type (Pass/Advanced), days in phase, assigned team member. Drag-and-drop phase transition is P2 (manual button trigger first). Depends on `StudentJourney` model with `currentPhase` enum |
| **Phase transition** — move a student from phase N to phase N+1 with a confirmation action | Team members perform phase transitions daily. Without this, the board is read-only and ClickUp remains necessary | LOW | Dedicated "Avançar Fase" button with confirmation modal. Records `PhaseHistory` entry (from_phase, to_phase, transitioned_by, transitioned_at, notes). All CS platforms (Gainsight CTAs, HubSpot pipeline stages) model this as explicit events, not auto-progression |
| **Student profile page** — single-student view with all context in one place | CS platforms universally expose a "360° account view." Teams cannot operate without one. Every tool — Gainsight, Vitally, Totango — treats this as their core screen | MEDIUM | Sections: contact info (from `Customer`), current phase + phase timeline, session history, English test result, assigned team members, notes, invoice/payment status (read from QB sync). No writes to QB/Pipedrive from this view |
| **Phase history timeline** — chronological list of phase transitions per student | Ops teams need audit trail. HubSpot CS Workspace shows activity log on every record. CoachVantage shows coaching log per engagement | LOW | `PhaseHistory` table: each row = one transition. Displayed as a vertical timeline on the student profile. Includes who moved them and any notes left at transition time |
| **Session logging** — record that a session happened (type, date, conducted by, notes) | CoachVantage's core feature is coaching hour logs. HubSpot CS tracks notes after every call. Session history is the primary evidence that work was done | LOW | Session types map to the journey: Bússola, Raio X, Devolutiva, Ongoing (mock interview), ad-hoc. `Session` table: student_id, type, date, conducted_by, duration_minutes (optional), notes. Not a scheduling tool — log after the fact |
| **Team member filter / assignment view** — "show me only my students" | HubSpot CS Workspace's primary UX pattern is a personalized workspace per CSM. Vitally and Gainsight both route tasks by owner. A team of 3 with defined responsibilities needs this to avoid noise | LOW | Fraenze sees all students. Dária sees phases 1-9. Rafael sees phases 10+. Filter by assignee on the pipeline board and list views. `StudentJourney.assignedTo` field (or two fields: `coordinator_id`, `advisor_id`) |
| **Daily action view** — per-team-member list of students needing attention today | HubSpot CS Workspace "Actions tab" with Overdue / Due Today views is the most-cited feature in CS tooling research. ClickUp replacement users specifically need a daily queue | HIGH | Rules engine: students SLA-trigger "needs attention" when they have been in their current phase beyond a phase-specific threshold (e.g., Board phase = 7 days, Material phase = 15 business days). Surface as a list per team member: student name, phase, days overdue, last action. No push notifications required |
| **Notes** — freeform per-student notes visible to the whole team | Every tool (CoachVantage, HubSpot, Gainsight) provides notes attached to a client record. Teams cannot share context without this | LOW | Simple `Note` model: student_id, author_id, content (text), created_at. Displayed in reverse-chronological order on student profile. No mentions or threading needed in v1 |

### Differentiators (Competitive Advantage)

Features that make this tool noticeably better than using ClickUp for this specific workflow. Not required to ship v1, but high team value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Debtor flag on pipeline board** — visual badge when a student has overdue invoices | ClickUp has no knowledge of QB payment status. This gives the coordinator (Fraenze) immediate visibility into debtors without switching to the Finance dashboard | LOW | Pull invoice status from existing `Invoice` model + QB sync. Badge on student card: "Em atraso" if any invoice is overdue. Coordinator-only context by default; all team members can see it. Read-only from QB data — no writes |
| **Phase SLA indicators** — visual signal when a student is past the expected time in their current phase | Totango's core philosophy is "tell you which customer needs attention and why." Phase SLA visibility means Fraenze can prioritize before the student complains. Not offered by generic PM tools | MEDIUM | Phase thresholds: Board = 7 calendar days, Material = 15 business days, Ongoing = renews every 6 months. Card shows green/amber/red indicator based on days_in_phase vs threshold. Feeds the daily action view. `PhaseThreshold` config table or hard-coded constants v1 |
| **Program type context** — Pass vs. Advanced displayed consistently throughout all views | Pass and Advanced programs have different deliverables and pacing. Dária and Rafael need this context always visible without opening the full profile | LOW | `StudentJourney.programType` enum (PASS / ADVANCED). Shown as a small badge on every student card and in the daily action list. Sourced from deal data at enrollment time |
| **Coordinator overview** — cross-team metrics screen for Fraenze: total active students, phase distribution, this week's sessions, phase age averages | ClickUp dashboards are generic. A custom view for Fraenze shows exactly what matters for program management: no student left behind, no phase stuck | MEDIUM | Metrics: count per phase, students in Material phase (most time-sensitive), sessions logged this week, students flagged in daily action view. Uses aggregated queries over `StudentJourney` + `Session` tables. No external analytics dependency |
| **Enrollment from existing Deal** — create a student journey record by selecting a won deal from Pipedrive/CRM | Reduces manual data entry. Student data (name, email, program type) already exists in `Customer` and deal records | MEDIUM | Ops team initiates "Onboard student" from a won deal in the dashboard. Creates `StudentJourney` record pre-populated from `Customer`. Assigns team members. Sets initial phase to Bastão. No new Pipedrive API calls if deal data is already synced |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Automated notifications / push alerts** | "Tell me when a student changes phase" sounds useful | For a 3-person team who will check the tool daily, push notifications add implementation complexity (email/Slack integration, preference management) and create noise. Industry pattern: Gainsight's automated health alerts are frequently cited as creating "alert fatigue" even in large CS teams | Daily action view + SLA indicators provide the same signal without infrastructure. Notification system is v2+ if team requests it after using the tool |
| **Session scheduling / calendar integration** | "Book a Bússola session directly in the tool" | Calendar sync (Google Calendar, Outlook) requires OAuth scopes and bidirectional sync complexity. CoachVantage's calendar feature is its most complex module. For a team of 3 doing Brazilian-market timezone scheduling, they already have their own calendar tools | Session logging (after-the-fact) delivers 90% of the value at 10% of the complexity. Schedule in your own calendar; log it here when done |
| **Student-facing portal updates from Ops Hub** | "When I change the phase, the student should see it in their Client Hub" | The Client Hub is a separate authenticated portal. Ops → Hub cross-portal writes introduce coupling between two independent auth systems. This is explicitly an architectural anti-pattern per CLAUDE.md (never mix portals) | Phase changes in the Ops Hub write to the shared `StudentJourney` table. If the Client Hub needs to surface phase info later, it reads from the same table. One-way data flow, no coupling |
| **Document storage / file uploads** | "Attach the resume draft to the student profile" | File storage requires S3/blob setup, upload APIs, file type validation, and storage cost management. DocuSign already handles contracts. Resumes and materials are shared externally (Google Drive, email) | Notes field can hold links (Google Drive URLs). File attachment is v2+ if the team confirms they need it in-tool rather than linked |
| **Real-time collaborative editing of notes** | "Two team members writing notes at same time" | A 3-person team that does not work simultaneously on the same student record does not need real-time sync. WebSocket infrastructure is explicitly out of scope per CLAUDE.md constraints | Optimistic UI with last-write-wins is sufficient. Notes have timestamps and author attribution. No conflicts in practice for this team size |
| **Phase automation / auto-advancement** | "After 7 days in Board phase, auto-advance to Bússola" | Journey phases require human judgment — a student who did not complete the Board deliverable should not auto-advance. Totango's playbook-driven auto-advancement is designed for product adoption signals, not service delivery milestones | SLA indicators and daily action view surface the need for human action. The team member clicks "Avançar Fase" intentionally. Automation is misaligned with the service model |

---

## Feature Dependencies

```
Customer model (existing)
    └──required by──> StudentJourney record creation
                          └──required by──> Pipeline board (read)
                          └──required by──> Student profile page
                          └──required by──> Phase transition action
                          └──required by──> Daily action view (SLA calc)
                          └──required by──> Coordinator overview (aggregates)

PhaseHistory model (new)
    └──required by──> Phase history timeline (student profile)
    └──required by──> Phase transition action (writes here on advance)

Session model (new)
    └──required by──> Session logging UI
    └──required by──> Session history on student profile
    └──required by──> Coordinator overview ("sessions this week")

Note model (new)
    └──required by──> Notes UI on student profile

Invoice model (existing QB sync)
    └──enhances──> Student profile (payment status section)
    └──enhances──> Debtor flag on pipeline board card

English test result (existing)
    └──enhances──> Student profile (test result section)

User model + RBAC (existing)
    └──required by──> Team member filter / "my students" view
    └──required by──> Session logging (conducted_by field)
    └──required by──> Phase transition (transitioned_by field)
    └──required by──> Note authorship
```

### Dependency Notes

- **`StudentJourney` model is the keystone**: Every single Ops Hub feature reads from or writes to this table. It must be designed first. All other new models hang off it.
- **Phase transition writes PhaseHistory**: The transition action and history timeline are one atomic operation — create both together, not as separate features.
- **Enrollment gate**: Before any student appears in the Ops Hub, a `StudentJourney` record must exist. The enrollment flow (from a won deal) is a prerequisite for the team to use any other feature.
- **Daily action view depends on SLA thresholds**: SLA config must be defined before the daily queue can compute anything. Even hard-coded constants unblock this.
- **Coordinator overview is last**: It's a read-only aggregation of data that all other features produce. Build it last.

---

## MVP Definition

### Launch With (v1) — "Can Replace ClickUp"

Minimum set for the team to stop using ClickUp for day-to-day student management.

- [ ] **StudentJourney data model** — `currentPhase`, `programType`, `assignedTo`, `enrolledAt`, linked to `Customer` — everything else depends on this
- [ ] **Phase pipeline board** — all students, 11 phase columns, student cards with name + program type + phase age + assignee badge
- [ ] **Phase transition** — "Avançar Fase" action with confirmation, writes `PhaseHistory` entry with notes
- [ ] **Phase history timeline** — chronological list on student profile
- [ ] **Student profile page** — contact info, current phase, phase history, session history, notes, English test result, invoice status
- [ ] **Session logging** — log a session (type, date, conducted by, notes) from the student profile
- [ ] **Team member filter** — "My students" toggle on pipeline board (Fraenze = all, Dária = phases 1-9, Rafael = phases 10+)
- [ ] **Notes** — add/view per-student notes on the profile page
- [ ] **Enrollment from existing Customer** — create a `StudentJourney` from a won deal / existing Customer record; assign team members; set initial phase

### Add After Validation (v1.x) — "Proactive Ops"

- [ ] **Daily action view** — SLA-based per-member queue, triggered when team asks "how do we know who to contact today?" (requires v1 data to define realistic SLA thresholds)
- [ ] **Phase SLA indicators** — green/amber/red on pipeline cards (requires real usage data to validate threshold values)
- [ ] **Debtor flag on pipeline card** — triggered when first coordinator sprint review reveals finance context is needed in the ops view
- [ ] **Coordinator overview** — metrics screen for Fraenze (triggered when v1 is in use and reporting needs emerge)
- [ ] **Program type badge** — shown as needed once team confirms Pass vs. Advanced affects their daily workflow decisions

### Future Consideration (v2+)

- [ ] **Enrollment from Pipedrive deal directly** — requires Pipedrive deal data to be surfaced in Ops Hub UI; current data is in dashboard portal
- [ ] **Document links / file attachments** — defer until team confirms Google Drive links in Notes are insufficient
- [ ] **Automated notifications** — defer until daily action view proves insufficient for surfacing overdue students
- [ ] **Client Hub phase display** — show student's current phase in their Client Hub portal; deferred until student-facing phase communication is validated as a need

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| StudentJourney data model | HIGH | MEDIUM | P1 |
| Phase pipeline board | HIGH | MEDIUM | P1 |
| Phase transition action | HIGH | LOW | P1 |
| Phase history timeline | HIGH | LOW | P1 |
| Student profile page | HIGH | MEDIUM | P1 |
| Session logging | HIGH | LOW | P1 |
| Team member filter | HIGH | LOW | P1 |
| Notes | MEDIUM | LOW | P1 |
| Enrollment flow | HIGH | MEDIUM | P1 |
| Daily action view | HIGH | HIGH | P2 |
| Phase SLA indicators | HIGH | MEDIUM | P2 |
| Debtor flag on card | MEDIUM | LOW | P2 |
| Coordinator overview | MEDIUM | MEDIUM | P2 |
| Program type badge | LOW | LOW | P2 |
| Document/file attachment | LOW | HIGH | P3 |
| Notifications (email/Slack) | MEDIUM | HIGH | P3 |
| Calendar scheduling integration | LOW | HIGH | P3 |
| Client Hub phase display | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for v1 launch — team cannot replace ClickUp without these
- P2: Should have — add once v1 is in production use; triggered by real usage pain
- P3: Nice to have — defer until product-market fit with this team is established

---

## Competitor Feature Analysis

| Feature Area | CoachVantage | HubSpot CS Workspace | Gainsight / Vitally | Our Approach |
|--------------|-------------|---------------------|---------------------|--------------|
| Phase pipeline | Per-client engagement with session count | Kanban board per pipeline with drag stages | Customizable Hubs / SuccessBLOCs per lifecycle stage | 11-column board fixed to Carreira phases — no generic pipeline builder needed |
| Daily task queue | None (scheduling-focused, not queue) | Actions tab: Overdue / Due Tomorrow / All | Automated CTAs triggered by health signals | SLA-based rule engine: days_in_phase vs phase threshold constant |
| Session logging | Core feature — auto logs coaching hours for certification | Notes after calls, manual activity logging | Activity feed with meeting recorder (Vitally) | Manual log-after-the-fact; no calendar integration v1 |
| Student/client profile | Contact + session notes + goals + invoices | 360° record: all activity, notes, health score | 360° view: CRM + product + support + billing | Same pattern: contact + phase timeline + session log + test result + payment status |
| Team assignment | Single coach per client | CSM property on record; workspace filtered by owner | Account ownership routing + playbook assignment | Assignee field on StudentJourney; filter toggle on board |
| Notifications | Email reminders for sessions | Task alerts for overdue items | Health score alerts, CTA routing | Deferred to v2 — daily action view is sufficient for 3-person team |

---

## Sources

- [CoachVantage Features — Coaching Management Software](https://www.coachvantage.com/coaches-platform-features)
- [HubSpot Customer Success Workspace — Use Guide](https://knowledge.hubspot.com/customer-success/use-the-customer-success-workspace)
- [HubSpot CS Workspace by Team Configuration](https://knowledge.hubspot.com/customer-success/create-customer-success-workspaces-for-teams)
- [LZC Marketing: HubSpot Customer Success Workspace Features](https://lzcmarketing.com/blog/hubspot-customer-success-workspace/)
- [Best Customer Success Platforms 2026 — thecscafe.com](https://www.thecscafe.com/p/best-customer-success-platforms)
- [Best Customer Success Tools 2026 — Userpilot](https://userpilot.com/blog/customer-success-tools/)
- [Gainsight vs Totango 2026 — oliv.ai](https://oliv.ai/blog/gainsight-vs-totango)
- [Gainsight Features 2026: Health Scores, Playbooks](https://www.oliv.ai/blog/gainsight-features)
- [Salesforce Education CRM: Student Lifecycle Management](https://www.rolustech.com/blog/salesforce-education-crm)
- [Education CRM Best Practices 2026 — Monday.com](https://monday.com/blog/crm-and-sales/crm-in-higher-education/)
- [What is Customer Success Operations? — Dock.us](https://www.dock.us/library/customer-success-operations)
- [Kanban Board Patterns — Atlassian](https://www.atlassian.com/agile/kanban/boards)

---

*Feature research for: Carreira USA Ops Hub — Student Journey Management (v1.2)*
*Researched: 2026-04-01*
