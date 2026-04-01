---
phase: 14-data-foundation
plan: "01"
subsystem: database
tags: [prisma, schema, seed, mentorship, data-foundation]
dependency_graph:
  requires: []
  provides: [MentorshipPhase, MentorshipEnrollment, MentorshipSession, PhaseTransition]
  affects: [prisma/schema.prisma, prisma/seed.ts, package.json]
tech_stack:
  added: [prisma/seed.ts with tsx runner]
  patterns: [upsert-by-unique-key seed pattern, string-enum for extensible status fields, named prisma relations for ambiguous FK pairs]
key_files:
  created:
    - prisma/seed.ts
  modified:
    - prisma/schema.prisma
    - package.json
decisions:
  - "Used npx tsx instead of ts-node for seed runner — ts-node not installed; tsx already used by all existing scripts"
  - "String fields for programType and status (not Prisma enums) — matches D-03 decision to avoid untransactable ALTER TYPE migrations"
  - "Named relations TransitionFrom and TransitionTo on PhaseTransition — required to disambiguate two FK refs to MentorshipPhase"
metrics:
  duration: "3 minutes"
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 3
---

# Phase 14 Plan 01: Mentorship Data Foundation Summary

Four Prisma models added for the mentorship data layer — MentorshipPhase lookup table (11 rows seeded), MentorshipEnrollment linking Customer + User, MentorshipSession for event logging, PhaseTransition for atomic phase history — schema pushed to database, seed verified idempotent.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add four mentorship models to schema.prisma | 9e954d1 | prisma/schema.prisma |
| 2 | Create seed script and push schema to database | b22a083 | prisma/seed.ts, package.json |

## Models Added

| Model | Table | Key Fields |
|-------|-------|------------|
| MentorshipPhase | mentorship_phases | key (unique), label, sortOrder (unique), slaDays |
| MentorshipEnrollment | mentorship_enrollments | programType (String), status (String), customerId FK, assignedToId FK, currentPhaseId FK |
| MentorshipSession | mentorship_sessions | sessionType (String), sessionDate, enrollmentId FK, conductorId FK |
| PhaseTransition | phase_transitions | enrollmentId FK, fromPhaseId FK (nullable), toPhaseId FK, triggeredById FK |

## Seed Rows (11 phases)

| sortOrder | key | label | slaDays |
|-----------|-----|-------|---------|
| 1 | bastao | Passagem de Bastão | 3 |
| 2 | cadastro | Cadastro | 3 |
| 3 | teste_de_ingles | Teste de Inglês | 7 |
| 4 | onboarding | Onboarding | 7 |
| 5 | board | Board | 7 |
| 6 | bussola | Bússola | 14 |
| 7 | raio_x | Raio X | 14 |
| 8 | material | Material | 21 |
| 9 | devolutiva | Devolutiva | 7 |
| 10 | ongoing | Ongoing | 60 |
| 11 | renovacao | Renovação | 14 |

## Verification Results

- `npx prisma validate` — exits 0, schema valid
- `npm run db:generate` — exits 0, Prisma Client generated without type errors
- `npm run db:push` — exits 0, database in sync (4 new tables created)
- First seed run: "Seeded 11 mentorship phases."
- Second seed run (idempotency): still 11 rows, no duplicates

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Replaced ts-node with npx tsx in seed command**
- **Found during:** Task 2, Step C (running `prisma db seed`)
- **Issue:** The plan specified `ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts` but `ts-node` is not installed in this project; `tsx` is already used by all other scripts (user:create, test:quickbooks, etc.)
- **Fix:** Changed `package.json` prisma.seed to `npx tsx prisma/seed.ts` — simpler and consistent with the rest of the project
- **Files modified:** package.json
- **Commit:** b22a083

## Known Stubs

None — all seed data is real, all schema relations are wired to existing Customer and User models.

## Self-Check: PASSED
