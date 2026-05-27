import assert from "node:assert/strict";
import test from "node:test";

import { EmailService, getOpsNotificationRecipients } from "../lib/services/email.service";

test("getOpsNotificationRecipients prefers EMAIL_OPS_TEAM and parses multiple recipients", () => {
  assert.deepEqual(
    getOpsNotificationRecipients({
      EMAIL_OPS_TEAM: "ops1@carreirausa.com, ops2@carreirausa.com ; ",
      EMAIL_SUPPORT_TEAM: "support@carreirausa.com",
    }),
    ["ops1@carreirausa.com", "ops2@carreirausa.com"],
  );
});

test("sendOpsFormSubmittedAlert emails ops with form and customer context", async () => {
  const service = Object.create(EmailService.prototype) as EmailService;
  let to: string | string[] = "";
  let subject = "";
  let html = "";

  (service as unknown as {
    sendEmailSimple: (template: { to: string | string[]; subject: string; html: string }) => Promise<boolean>;
  }).sendEmailSimple = async (template) => {
    to = template.to;
    subject = template.subject;
    html = template.html;
    return true;
  };

  await service.sendOpsFormSubmittedAlert(
    {
      id: "customer_1",
      name: "Maria Silva",
      email: "maria@example.com",
    },
    {
      formTitle: "Onboarding Career",
      assignmentId: "assignment_1",
      submissionId: "submission_1",
      submittedAt: new Date("2026-05-27T03:00:00.000Z"),
      enrollmentId: "enrollment_1",
    },
    { EMAIL_OPS_TEAM: "ops@carreirausa.com" },
  );

  assert.deepEqual(to, ["ops@carreirausa.com"]);
  assert.match(subject, /Formulario respondido/);
  assert.match(subject, /Maria Silva/);
  assert.match(html, /Onboarding Career/);
  assert.match(html, /maria@example\.com/);
  assert.match(html, /\/ops\/students\/enrollment_1/);
});

test("sendHubEnglishTestPending emails the customer with the test CTA", async () => {
  const service = Object.create(EmailService.prototype) as EmailService;
  let to: string | string[] = "";
  let subject = "";
  let html = "";

  (service as unknown as {
    sendEmailSimple: (template: { to: string | string[]; subject: string; html: string }) => Promise<boolean>;
  }).sendEmailSimple = async (template) => {
    to = template.to;
    subject = template.subject;
    html = template.html;
    return true;
  };

  await service.sendHubEnglishTestPending({
    id: "customer_1",
    name: "Maria Silva",
    email: "maria@example.com",
    preferredLanguage: "pt-BR",
  });

  assert.equal(to, "maria@example.com");
  assert.match(subject, /teste de ingles/i);
  assert.match(html, /\/hub\/test/);
  assert.match(html, /Maria/);
});

test("sendOpsEnglishTestCompletedAlert emails ops with score context", async () => {
  const service = Object.create(EmailService.prototype) as EmailService;
  let to: string | string[] = "";
  let subject = "";
  let html = "";

  (service as unknown as {
    sendEmailSimple: (template: { to: string | string[]; subject: string; html: string }) => Promise<boolean>;
  }).sendEmailSimple = async (template) => {
    to = template.to;
    subject = template.subject;
    html = template.html;
    return true;
  };

  await service.sendOpsEnglishTestCompletedAlert(
    {
      id: "customer_1",
      name: "Maria Silva",
      email: "maria@example.com",
    },
    {
      testKind: "WRITTEN",
      testId: "test_1",
      cefrLevel: "B1",
      displayLevel: "Intermediate",
      score: 72,
      enrollmentId: "enrollment_1",
    },
    { EMAIL_OPS_TEAM: "ops@carreirausa.com" },
  );

  assert.deepEqual(to, ["ops@carreirausa.com"]);
  assert.match(subject, /Teste de ingles respondido/);
  assert.match(html, /WRITTEN/);
  assert.match(html, /B1/);
  assert.match(html, /72/);
  assert.match(html, /\/ops\/students\/enrollment_1/);
});
