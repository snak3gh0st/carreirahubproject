import test from "node:test";
import assert from "node:assert/strict";

import {
  getApiErrorMessage,
  parseOpsProfilePatchInput,
} from "../lib/ops/ops-profile-schema";

test("parseOpsProfilePatchInput accepts blank seniority as null", () => {
  const parsed = parseOpsProfilePatchInput({
    seniority: "",
    renewalState: "NOT_DUE",
  });

  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal(parsed.data.seniority, null);
  }
});

test("getApiErrorMessage renders field-error objects instead of [object Object]", () => {
  assert.equal(
    getApiErrorMessage(
      {
        seniority: [
          "Invalid enum value. Expected 'ENTRY_LEVEL' | 'MID_LEVEL' | 'SENIOR' | 'DIRECTOR', received ''",
        ],
      },
      "Erro ao salvar perfil operacional"
    ),
    "seniority: Invalid enum value. Expected 'ENTRY_LEVEL' | 'MID_LEVEL' | 'SENIOR' | 'DIRECTOR', received ''"
  );
});
