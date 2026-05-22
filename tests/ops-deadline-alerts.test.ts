import test from "node:test";
import assert from "node:assert/strict";

import { buildOpsDeadlineAlertCandidates } from "../lib/ops/deadline-alerts";

test("buildOpsDeadlineAlertCandidates creates SLA, stale session, and renewal alerts", () => {
  const now = new Date("2026-05-22T00:00:00.000Z");
  const candidates = buildOpsDeadlineAlertCandidates([
    {
      id: "enrollment_1",
      startDate: new Date("2026-05-01T00:00:00.000Z"),
      customer: { id: "customer_1", name: "Student One", email: "student@example.com" },
      assignedTo: { id: "user_1", name: "Roberta" },
      currentPhase: { key: "material", label: "Em processo de revisão", slaDays: 21 },
      transitions: [{ createdAt: new Date("2026-05-01T00:00:00.000Z") }],
      sessions: [{ sessionDate: new Date("2026-05-01T00:00:00.000Z") }],
      opsProfile: { renewalDate: new Date("2026-06-01T00:00:00.000Z") },
    },
  ], now);

  assert.deepEqual(candidates.map((candidate) => candidate.data.alertType), [
    "SLA",
    "NO_RECENT_SESSION",
    "RENEWAL",
  ]);
  assert.equal(candidates[2].data.channelPolicy, "MANUAL_ONLY");
});
