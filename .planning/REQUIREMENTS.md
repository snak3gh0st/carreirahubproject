# Requirements: Carreira AI Hub

**Defined:** 2026-04-01
**Core Value:** Give the Carreira USA support team a single operational workspace to track every student's journey phase, replacing ClickUp as the team's hub.

## v1.2 Requirements — Ops Hub: Student Journey Management

### Data Foundation

- [x] **DATA-01**: System stores 11 mentorship phases as DB rows with key, label, and sortOrder — not a Prisma enum
- [x] **DATA-02**: Ops team member can create a MentorshipEnrollment for any Customer with program type (Pass/Advanced), assigned team member, and start date
- [x] **DATA-03**: System records a PhaseTransition row (timestamp, from-phase, to-phase, triggered-by user) every time a student's phase changes
- [x] **DATA-04**: Ops team member can log a MentorshipSession with session type, conductor (User), session date, and optional notes

### Pipeline Board

- [x] **PIPE-01**: Ops team member sees all active enrollments grouped by current phase in a Kanban board layout
- [x] **PIPE-02**: Ops team member can advance a student to the next valid phase via drag-and-drop or a phase advance button
- [x] **PIPE-03**: Ops team member can filter the pipeline board to show only students assigned to a specific team member
- [x] **PIPE-04**: Pipeline board shows an overdue indicator on student cards when the student has exceeded the expected SLA for their current phase
- [x] **PIPE-05**: Pipeline board shows a debtor flag on student cards when the student has an overdue QB payment balance

### Student Profile

- [ ] **PROF-01**: Ops team member can view a student's full profile including contact info, program type, English test result (CEFR level), assigned team member, and current phase
- [ ] **PROF-02**: Student profile shows a chronological timeline of all phase transitions with dates and who triggered each transition
- [ ] **PROF-03**: Student profile shows a paginated log of all sessions with type, conductor, date, and notes

### Enrollment

- [x] **ENRL-01**: Ops team member can manually enroll an existing Customer into a mentorship program by selecting program type and assigned team member
- [x] **ENRL-02**: Enrollment form includes a Customer search by name or email to select the student being enrolled

### Daily Action View

- [x] **DAILY-01**: Ops team member sees a daily action list scoped to their assigned students that require attention today based on phase and SLA rules
- [x] **DAILY-02**: Daily action view flags students whose current phase SLA expires within the next 2 days
- [x] **DAILY-03**: Daily action view flags students who have had no session logged in the past 7 days

### Coordinator Overview

- [ ] **COORD-01**: Coordinator can view phase distribution metrics — count of active students per phase across all team members
- [ ] **COORD-02**: Coordinator can view all active enrollments regardless of assigned team member (no scoping filter)
- [ ] **COORD-03**: Coordinator sees a list of students with no session activity in the past 7 days
- [ ] **COORD-04**: Coordinator sees a list of students with overdue QB payment balances (debtors)

---

## v1.3 Requirements (Deferred)

### Automation

- **AUTO-01**: Enrollment is created automatically when a Pipedrive Deal is marked Won (webhook trigger)
- **AUTO-02**: Daily WhatsApp message templates can be sent from Ops Hub per student phase

### Communication

- **COMM-01**: Ops team member can write free-text notes/observations per student visible to the whole team
- **COMM-02**: Google Calendar invites are created when a session is scheduled from Ops Hub

### Reporting

- **RPT-01**: Coordinator sees NPS entry/exit scores per student on their profile
- **RPT-02**: Coordinator can export student phase distribution as CSV

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| WhatsApp sending | No integrations in v1.2 — keep scope tight |
| Google Calendar integration | No integrations in v1.2 |
| Invoice creation from Ops Hub | Handled by Admin Dashboard — no duplication |
| Student-facing portal writes | Violates two-portal separation rule in CLAUDE.md |
| Automated notifications/alerts | Alert fatigue risk; defer to v1.3 with real SLA data |
| Bulk phase operations | Scope creep — single-student flow first |
| Notes/observations (v1.2) | Deferred to v1.3 to keep profile scope focused |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 | Phase 14 | Complete |
| DATA-02 | Phase 14 | Complete |
| DATA-03 | Phase 14 | Complete |
| DATA-04 | Phase 14 | Complete |
| ENRL-01 | Phase 14 | Complete |
| ENRL-02 | Phase 14 | Complete |
| PIPE-01 | Phase 15 | Complete |
| PIPE-02 | Phase 15 | Complete |
| PIPE-03 | Phase 15 | Complete |
| PIPE-04 | Phase 15 | Complete |
| PIPE-05 | Phase 15 | Complete |
| PROF-01 | Phase 16 | Pending |
| PROF-02 | Phase 16 | Pending |
| PROF-03 | Phase 16 | Pending |
| DAILY-01 | Phase 17 | Complete |
| DAILY-02 | Phase 17 | Complete |
| DAILY-03 | Phase 17 | Complete |
| COORD-01 | Phase 17 | Pending |
| COORD-02 | Phase 17 | Pending |
| COORD-03 | Phase 17 | Pending |
| COORD-04 | Phase 17 | Pending |

**Coverage:**
- v1.2 requirements: 21 total
- Mapped to phases: 21
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-01*
*Last updated: 2026-04-01 — Traceability confirmed after roadmap creation*
