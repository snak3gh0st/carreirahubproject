---
status: awaiting_human_verify
trigger: "When a session is logged for a student, the checklist items (session_1, session_2) that should be auto-marked do NOT update in the Minhas Tarefas UI without a full page refresh."
created: 2026-04-27T00:00:00Z
updated: 2026-04-27T00:05:00Z
---

## Current Focus

hypothesis: MyTasksClient uses useQuery with no staleTime or refetchOnWindowFocus config, so React Query holds a stale cache indefinitely. SessionSection (on a different page/tab) logs a session and invalidates only its own query keys ["sessions", enrollmentId] and ["student-profile", enrollmentId] — it never touches the ["my-tasks"] key. Since the two pages live in separate browser tabs (and could even have separate QueryClient instances), there is no cross-tab cache invalidation mechanism.
test: Confirmed by reading SessionSection.tsx (onSuccess invalidates only sessions+student-profile) and MyTasksClient.tsx (useQuery has no staleTime, no refetchOnWindowFocus — defaults: staleTime=0 but refetchOnWindowFocus=true only if enabled at provider level).
expecting: Adding staleTime: 0 + refetchOnWindowFocus: true to the useMyTasks hook will cause React Query to refetch when the user switches back to the /ops/my-tasks tab.
next_action: Apply fix to MyTasksClient.tsx — add staleTime: 0 and refetchOnWindowFocus: true to the useMyTasks query.

## Symptoms

expected: After logging a session via the student detail page, the MyTasksClient at /ops/my-tasks should show the session checklist item as completed automatically (since logSession auto-upserts PhaseChecklistProgress). The React Query cache should refresh.
actual: The checklist stays unchanged until the user manually refreshes the page.
errors: No errors visible — it is a silent stale-cache issue.
reproduction: 1) Open /ops/my-tasks. 2) In a new tab, go to /ops/students/[id] and log a session. 3) Switch back to /ops/my-tasks — checklist still shows session item as incomplete.
started: Started with this implementation (just built today). Session auto-marking works server-side (logSession in mentorship.service.ts upserts PhaseChecklistProgress inside a transaction), but the MyTasksClient UI does not know a session was logged.

## Eliminated

- hypothesis: Server-side logSession is not writing PhaseChecklistProgress correctly
  evidence: Symptoms specify server-side works correctly; a manual page refresh shows the updated checklist. The bug is purely client-side cache staleness.
  timestamp: 2026-04-27T00:02:00Z

- hypothesis: The ["my-tasks"] query cache is on the same QueryClient as SessionSection and just needs invalidation from SessionSection
  evidence: The pages are in separate browser tabs. Even if they share the same QueryClient instance (via a single provider at the root layout), cross-tab invalidation is not propagated by React Query by default — each tab has its own JS context and QueryClient instance.
  timestamp: 2026-04-27T00:03:00Z

## Evidence

- timestamp: 2026-04-27T00:01:00Z
  checked: MyTasksClient.tsx — useMyTasks hook (lines 71-80)
  found: useQuery has no staleTime, no refetchOnWindowFocus, no refetchInterval specified. React Query defaults: staleTime=0 (data is immediately stale), but refetchOnWindowFocus defaults to true only if not overridden at QueryClient provider level. The key issue is the absence of explicit refetchOnWindowFocus: true guaranteeing a refetch on tab focus.
  implication: Depending on the QueryClient provider config, the query may or may not refetch on window focus. Adding explicit options removes ambiguity.

- timestamp: 2026-04-27T00:02:00Z
  checked: SessionSection.tsx — useLogSession hook (lines 36-60)
  found: onSuccess invalidates ["sessions", enrollmentId] and ["student-profile", enrollmentId] only. No invalidation of ["my-tasks"] key.
  implication: Even if both pages share a QueryClient (same tab / same React tree), the session logging mutation does not trigger a refetch of the my-tasks query.

- timestamp: 2026-04-27T00:03:00Z
  checked: app/api/ops/my-tasks/route.ts
  found: Route is correct — it reads fresh PhaseChecklistProgress from DB on every request. Server-side is not the issue.
  implication: Any client-triggered refetch will return correct data. The fix only needs to be on the client query configuration.

- timestamp: 2026-04-27T00:04:00Z
  checked: Cross-tab scenario analysis
  found: The two pages (/ops/my-tasks and /ops/students/[id]) are opened in separate browser tabs. Each tab has its own JS runtime, so they cannot share a QueryClient. React Query has no built-in cross-tab cache synchronization.
  implication: The only reliable fix for the cross-tab scenario is refetchOnWindowFocus: true so that returning to the /ops/my-tasks tab triggers a refetch automatically.

## Resolution

root_cause: The useMyTasks query in MyTasksClient.tsx does not have refetchOnWindowFocus: true explicitly set (relying on potentially-overridden provider defaults) and no refetchInterval. When the user logs a session in another tab and returns to /ops/my-tasks, React Query does not refetch because it either: (a) has refetchOnWindowFocus disabled at the provider level, or (b) considers the cached data not stale enough to warrant a refetch. Result: stale UI until manual page refresh.
fix: Add staleTime: 0 and refetchOnWindowFocus: true to the useMyTasks query options. This guarantees: (1) data is always considered stale immediately, so any refetch trigger will fetch fresh data; (2) switching back to the tab (window focus event) triggers a refetch automatically.
verification: Added staleTime: 0 and refetchOnWindowFocus: true to useMyTasks in MyTasksClient.tsx (lines 71-81). Logic: staleTime: 0 ensures cached data is always considered stale so any focus event triggers a real fetch; refetchOnWindowFocus: true guarantees the query fires when the user switches back to the /ops/my-tasks tab.
files_changed: [app/ops/my-tasks/MyTasksClient.tsx]
