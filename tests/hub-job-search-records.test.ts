import test from "node:test";
import assert from "node:assert/strict";

import {
  buildHubJobSearchActivityData,
  parseHubJobSearchRecordInput,
  summarizeHubJobSearchActivities,
} from "../lib/hub/job-search-records";

test("parseHubJobSearchRecordInput requires job URL for applications", () => {
  const parsed = parseHubJobSearchRecordInput({
    type: "APPLICATION",
    activityDate: "2026-05-26",
    company: "Stripe",
    roleTitle: "Product Analyst",
  });

  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.deepEqual(parsed.error.flatten().fieldErrors.jobUrl, [
      "Link da vaga é obrigatório para aplicações.",
    ]);
  }
});

test("buildHubJobSearchActivityData maps task records to student-visible activity data", () => {
  const parsed = parseHubJobSearchRecordInput({
    type: "TASK",
    activityDate: "2026-05-26",
    roleTitle: "Follow up with recruiter",
    notes: "Send message after the screening call.",
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;

  const data = buildHubJobSearchActivityData(parsed.data, "enrollment_1");

  assert.equal(data.enrollmentId, "enrollment_1");
  assert.equal(data.type, "TASK");
  assert.equal(data.roleTitle, "Follow up with recruiter");
  assert.equal(data.visibility, "STUDENT_VISIBLE");
  assert.equal(data.status, "PENDENTE");
  assert.equal(data.createdById, null);
  assert.deepEqual(data.metadata, { createdFrom: "CLIENT_HUB" });
});

test("summarizeHubJobSearchActivities counts records by Hub type", () => {
  const summary = summarizeHubJobSearchActivities([
    { type: "APPLICATION", status: "EM_PROCESSO" },
    { type: "APPLICATION", status: "PASSOU" },
    { type: "INTERVIEW", status: "REMARCADO" },
    { type: "TASK", status: "PENDENTE" },
    { type: "TASK", status: "CONCLUIDO" },
    { type: "OFFER", status: "OFERTA" },
    { type: "MOCK_INTERVIEW", status: "PASSOU" },
  ]);

  assert.deepEqual(summary, {
    applications: 2,
    interviews: 1,
    tasks: 2,
    openTasks: 1,
    offers: 1,
    total: 6,
  });
});
