import test from "node:test";
import assert from "node:assert/strict";

import {
  buildOperationalActorPayload,
  formatOpsStaffMemberLabel,
  parseOpsStaffMemberInput,
} from "../lib/ops/staff-members";

test("parseOpsStaffMemberInput accepts former staff without login email", () => {
  const parsed = parseOpsStaffMemberInput({
    name: "  Maria Raio X  ",
    email: "",
    status: "FORMER",
    areas: ["RAIO_X", " RAIO_X ", "", "CV_REVIEW"],
    notes: " atuou no raio x ",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.deepEqual(parsed.data, {
      name: "Maria Raio X",
      email: null,
      status: "FORMER",
      areas: ["RAIO_X", "CV_REVIEW"],
      notes: "atuou no raio x",
    });
  }
});

test("formatOpsStaffMemberLabel marks former employees clearly", () => {
  assert.equal(
    formatOpsStaffMemberLabel({ name: "Maria Raio X", status: "FORMER" }),
    "Maria Raio X (ex-funcionário)"
  );
});

test("buildOperationalActorPayload defaults blank selection to the recorder user", () => {
  assert.deepEqual(buildOperationalActorPayload("", "user_current"), {
    kind: "user",
    performedByUserId: "user_current",
    performedByStaffId: null,
    sessionConductorId: "user_current",
  });
});

test("buildOperationalActorPayload maps former staff tokens without login access", () => {
  assert.deepEqual(buildOperationalActorPayload("staff:staff_former", "user_current"), {
    kind: "staff",
    performedByUserId: null,
    performedByStaffId: "staff_former",
    sessionConductorId: "user_current",
  });
});

test("buildOperationalActorPayload maps active user tokens for existing staff", () => {
  assert.deepEqual(buildOperationalActorPayload("user:user_active", "user_current"), {
    kind: "user",
    performedByUserId: "user_active",
    performedByStaffId: null,
    sessionConductorId: "user_active",
  });
});
