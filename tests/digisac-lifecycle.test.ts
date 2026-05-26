import test from "node:test";
import assert from "node:assert/strict";

import {
  DIGISAC_LIFECYCLE_DEFAULT_START_AT,
  buildDigisacLifecycleDedupeKey,
  buildDigisacLifecycleMessage,
  getDigisacLifecycleHubUrl,
  getDigisacLifecycleRenewalMilestone,
  isDigisacLifecycleAutomationEnabled,
  isEligibleForDigisacLifecycleBackfillProtection,
  sendDigisacLifecycleMessage,
} from "../lib/ops/digisac-lifecycle";

test("buildDigisacLifecycleMessage renders fixed PT-BR templates with hub link", () => {
  const welcome = buildDigisacLifecycleMessage({
    event: "program_welcome",
    customerName: "Maria Silva",
    hubUrl: "https://app.carreirausa.com/hub/login",
    programType: "PASS",
  });

  assert.match(welcome, /Maria/);
  assert.match(welcome, /bem-vindo/i);
  assert.match(welcome, /Carreira USA/);
  assert.match(welcome, /https:\/\/app\.carreirausa\.com\/hub\/login/);

  const form = buildDigisacLifecycleMessage({
    event: "form_assigned",
    customerName: "Maria Silva",
    hubUrl: "https://app.carreirausa.com/hub/login",
    title: "Formulário de Onboarding",
  });

  assert.match(form, /novo formulario/i);
  assert.match(form, /Formulário de Onboarding/);
});

test("isDigisacLifecycleAutomationEnabled is on by default and accepts explicit kill switch", () => {
  assert.equal(isDigisacLifecycleAutomationEnabled({}), true);
  assert.equal(isDigisacLifecycleAutomationEnabled({ DIGISAC_LIFECYCLE_AUTOMATIONS_ENABLED: "true" }), true);
  assert.equal(isDigisacLifecycleAutomationEnabled({ DIGISAC_LIFECYCLE_AUTOMATIONS_ENABLED: "0" }), false);
  assert.equal(isDigisacLifecycleAutomationEnabled({ DIGISAC_LIFECYCLE_AUTOMATIONS_ENABLED: "false" }), false);
  assert.equal(isDigisacLifecycleAutomationEnabled({ DIGISAC_LIFECYCLE_AUTOMATIONS_ENABLED: "off" }), false);
});

test("getDigisacLifecycleHubUrl accepts explicit hub URL or derives from app URL", () => {
  assert.equal(
    getDigisacLifecycleHubUrl({ NEXT_PUBLIC_APP_URL: "https://app.carreirausa.com/" }),
    "https://app.carreirausa.com/hub/login"
  );
  assert.equal(
    getDigisacLifecycleHubUrl({ DIGISAC_LIFECYCLE_HUB_URL: "https://portal.carreirausa.com/custom/" }),
    "https://portal.carreirausa.com/custom"
  );
});

test("renewal helpers protect existing backlog by activation date", () => {
  assert.equal(DIGISAC_LIFECYCLE_DEFAULT_START_AT, "2026-05-25T00:00:00.000Z");
  assert.equal(
    isEligibleForDigisacLifecycleBackfillProtection({
      createdAt: new Date("2026-05-24T23:59:59.000Z"),
      env: {},
    }),
    false
  );
  assert.equal(
    isEligibleForDigisacLifecycleBackfillProtection({
      createdAt: new Date("2026-05-25T00:00:00.000Z"),
      env: {},
    }),
    true
  );
  assert.equal(
    isEligibleForDigisacLifecycleBackfillProtection({
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      env: { DIGISAC_LIFECYCLE_START_AT: "2025-01-01T00:00:00.000Z" },
    }),
    true
  );
});

test("getDigisacLifecycleRenewalMilestone chooses the nearest pending reminder window", () => {
  assert.equal(getDigisacLifecycleRenewalMilestone(30), "30");
  assert.equal(getDigisacLifecycleRenewalMilestone(16), "30");
  assert.equal(getDigisacLifecycleRenewalMilestone(15), "15");
  assert.equal(getDigisacLifecycleRenewalMilestone(8), "15");
  assert.equal(getDigisacLifecycleRenewalMilestone(7), "7");
  assert.equal(getDigisacLifecycleRenewalMilestone(0), null);
  assert.equal(getDigisacLifecycleRenewalMilestone(31), null);
});

test("buildDigisacLifecycleDedupeKey creates stable event keys", () => {
  assert.equal(
    buildDigisacLifecycleDedupeKey("form_assigned", "assignment_123"),
    "digisac:lifecycle:form_assigned:assignment_123"
  );
});

test("sendDigisacLifecycleMessage dedupes successful events before calling Digisac", async () => {
  let sent = 0;
  const result = await sendDigisacLifecycleMessage(
    {
      event: "form_assigned",
      enrollmentId: "enrollment_1",
      dedupeKey: "digisac:lifecycle:form_assigned:assignment_1",
      title: "Onboarding",
    },
    {
      env: {},
      getConfig: () => ({
        enabled: true,
        apiBaseUrl: "https://digisac.test/api/v1",
        apiToken: "token",
        serviceId: "service_1",
        workspaceUrl: "https://digisac.test",
        defaultCountryCode: "55",
        missing: [],
      }),
      prisma: {
        integrationLog: {
          findFirst: async () => ({ id: "log_1" }),
          create: async () => ({}),
        },
        mentorshipEnrollment: {
          findUnique: async () => ({
            id: "enrollment_1",
            programType: "PASS",
            customer: {
              id: "customer_1",
              name: "Maria Silva",
              email: "maria@example.com",
              phone: "+5511999999999",
            },
          }),
        },
      },
      sendMessage: async () => {
        sent++;
        throw new Error("should not send duplicate");
      },
      storeOutbound: async () => ({}),
    }
  );

  assert.equal(result.sent, false);
  assert.equal(result.skippedReason, "duplicate");
  assert.equal(sent, 0);
});

test("sendDigisacLifecycleMessage sends and stores a new lifecycle message", async () => {
  const logs: Array<Record<string, unknown>> = [];
  let sentText = "";
  let storedText = "";

  const result = await sendDigisacLifecycleMessage(
    {
      event: "document_available",
      enrollmentId: "enrollment_1",
      dedupeKey: "digisac:lifecycle:document_available:document_1",
      title: "Currículo final",
    },
    {
      env: { NEXT_PUBLIC_APP_URL: "https://app.carreirausa.com" },
      getConfig: () => ({
        enabled: true,
        apiBaseUrl: "https://digisac.test/api/v1",
        apiToken: "token",
        serviceId: "service_1",
        workspaceUrl: "https://digisac.test",
        defaultCountryCode: "55",
        missing: [],
      }),
      prisma: {
        integrationLog: {
          findFirst: async () => null,
          create: async ({ data }: any) => {
            logs.push(data);
            return data;
          },
        },
        mentorshipEnrollment: {
          findUnique: async () => ({
            id: "enrollment_1",
            programType: "PASS",
            customer: {
              id: "customer_1",
              name: "Maria Silva",
              email: "maria@example.com",
              phone: "+5511999999999",
            },
          }),
        },
      },
      sendMessage: async (input) => {
        sentText = input.text;
        return {
          externalId: "msg_1",
          contactId: "contact_1",
          ticketId: "ticket_1",
          serviceId: input.serviceId ?? null,
          status: "sent",
          raw: { id: "msg_1" },
        };
      },
      storeOutbound: async (input) => {
        storedText = input.text;
        assert.equal(input.sentById, null);
        assert.equal((input.result.raw as any).automation.dedupeKey, "digisac:lifecycle:document_available:document_1");
        return {};
      },
    }
  );

  assert.equal(result.sent, true);
  assert.match(sentText, /Currículo final/);
  assert.equal(storedText, sentText);
  assert.equal(logs[0].action, "LIFECYCLE_MESSAGE_SENT");
});
