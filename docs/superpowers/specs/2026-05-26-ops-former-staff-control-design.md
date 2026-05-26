# Ops Former Staff Control Design

## Goal

Allow operational managers to register former employees for internal control only, assign them to operational areas, and select them in historical student work without creating Hub or internal login access.

## Scope

Former employees are not `User` records. They do not have passwords, invites, NextAuth sessions, or Hub access. Active operational users continue to use the existing `/ops/team` user flow.

## Data Model

Add `OpsStaffMember` for non-login operational people:

- `name`
- optional `email`
- fixed status `FORMER`
- `areas` as phase/area keys
- optional `notes`

Add optional performed-by references on activity and session history. The existing `createdById` and `conductorId` remain the audit fields for the logged-in user who records the data.

## UX

`/ops/team` gains a former-employee section where operational managers can add names, optional email, notes, and assigned areas. Student activity and session forms gain a "Quem atuou" selector containing active operational users plus former employees. Former employees are visibly labeled as ex-funcionarios in lists and history.

## Access Rules

Operational access roles can read former employees for selection. Only operational managers can create former-employee records.

## Testing

Add focused unit tests for staff input normalization and actor selection mapping before implementation. Run those tests red/green, then run TypeScript validation.
