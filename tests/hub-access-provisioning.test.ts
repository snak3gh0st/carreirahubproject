import test from "node:test";
import assert from "node:assert/strict";

import { provisionHubAccessForEnrollment } from "../lib/ops/hub-access-provisioning";

test("provisionHubAccessForEnrollment creates portal user and sends setup link", async () => {
  const calls: string[] = [];
  const expiresAt = new Date("2026-05-27T12:00:00.000Z");

  const result = await provisionHubAccessForEnrollment(
    { enrollmentId: "enrollment_1" },
    {
      prismaClient: {
        mentorshipEnrollment: {
          findUnique: async () => ({
            id: "enrollment_1",
            programType: "EARLY_CAREER",
            customer: {
              id: "customer_1",
              name: "Darlan Gomes",
              email: "DarlanGomes11@gmail.com ",
              preferredLanguage: "pt-BR",
              clientUser: null,
            },
          }),
        },
        clientUser: {
          create: async ({ data }: any) => {
            calls.push(`create:${data.email}:${data.language}:${data.resetToken}`);
            assert.equal(data.customerId, "customer_1");
            assert.equal(data.mustResetPw, true);
            assert.equal(data.resetTokenExpiresAt, expiresAt);
            return { id: "client_user_1" };
          },
          update: async () => {
            throw new Error("update should not be called for a new portal user");
          },
        },
      } as any,
      notificationService: {
        sendHubAccessInvite: async (customer: any, resetUrl: string) => {
          calls.push(`email:${customer.email}:${resetUrl}`);
        },
      },
      generateResetToken: () => "token_123",
      getResetExpiry: () => expiresAt,
      buildResetUrl: (token: string) => `https://app.carreirausa.com/hub/set-password?token=${token}`,
      generateTempPassword: () => "TempPass123!",
      hashPassword: async (password: string) => `hashed:${password}`,
    }
  );

  assert.deepEqual(result, {
    success: true,
    email: "darlangomes11@gmail.com",
    clientUserCreated: true,
    resetTokenExpiresAt: expiresAt,
  });
  assert.deepEqual(calls, [
    "create:darlangomes11@gmail.com:pt-BR:token_123",
    "email:darlangomes11@gmail.com:https://app.carreirausa.com/hub/set-password?token=token_123",
  ]);
});

test("provisionHubAccessForEnrollment pauses new PASS portal access", async () => {
  const result = await provisionHubAccessForEnrollment(
    { enrollmentId: "enrollment_2" },
    {
      prismaClient: {
        mentorshipEnrollment: {
          findUnique: async () => ({
            id: "enrollment_2",
            programType: "PASS",
            customer: {
              id: "customer_2",
              name: "Paula Silva",
              email: "paula@example.com",
              preferredLanguage: "pt-BR",
              clientUser: null,
            },
          }),
        },
        clientUser: {
          create: async () => {
            throw new Error("create should not be called while hub access is paused");
          },
          update: async () => {
            throw new Error("update should not be called while hub access is paused");
          },
        },
      } as any,
    }
  );

  assert.deepEqual(result, {
    success: false,
    reason: "HUB_ACCESS_PAUSED",
  });
});
