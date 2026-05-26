# Hub Job Search Records Design

## Goal

Give the client Hub a lightweight job-search control surface where students can record applications, interviews, tasks, and offers without waiting on the internal team to enter every update.

## UX Decision

Use the selected Option C with two layers:

- Home quick actions: a compact "Registrar avanço da busca" section with one-click entry points for application, interview, task, and offer.
- Full history page: a "Meus Registros" page where the student can review all submitted records, filter by type, and add another record.

The Home should optimize for fast capture. The history page should optimize for control and accountability. Both should write to the same operational activity model so internal staff and AI tools see the same facts in the existing student profile.

## Data Model

Reuse `OpsStudentActivity` instead of creating a parallel table. Student-created records use:

- `type`: `APPLICATION`, `INTERVIEW`, `TASK`, or `OFFER`
- `visibility`: `STUDENT_VISIBLE`
- `createdById`: `null`, because the creator is the Hub client, not an internal `User`
- `metadata`: source marker such as `{ "createdFrom": "CLIENT_HUB" }`

The feature only uses the active enrollment for the authenticated customer. If there is no active enrollment, the Hub returns a clear unavailable state instead of writing orphan records.

## API

Add `/api/hub/job-search`:

- `GET`: lists authenticated customer's active-enrollment records.
- `POST`: validates a submitted record, applies type-specific defaults, and creates a `STUDENT_VISIBLE` activity.

Validation keeps friction low but protects operational quality:

- Application requires company, role title, and job URL.
- Interview requires company, role title, and date.
- Task requires title and date.
- Offer requires company, role title, and date.

## UI

Home adds a client component for quick record creation and summary counts. The component receives recent counts from the server, opens a modal with type-specific labels, posts to the Hub API, and refreshes the page after success.

`/hub/registros` shows:

- Header with summary counters.
- Type filters.
- Add button opening the same modal.
- Recent record list with status, company/title, date, source/link, and notes.
- Empty state encouraging the first record.

Use existing brand colors, Tailwind, Radix dialog, and `lucide-react` icons. Avoid emoji in the new UI.

## Error Handling

- Unauthorized requests return `401`.
- Missing active enrollment returns `404` from POST and an empty unavailable state from the page.
- Validation errors return a string plus field details, never `[object Object]`.
- UI shows inline errors in the modal and keeps entered data.

## Testing

Add focused unit tests for:

- Schema normalization and required fields.
- Summary counters.
- Mapping records to `STUDENT_VISIBLE` activity create data.

Run focused tests plus TypeScript validation before completion.
