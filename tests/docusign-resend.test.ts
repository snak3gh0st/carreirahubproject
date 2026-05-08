import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEnvelopeResendRequest,
  isContractResendableStatus,
} from "@/lib/services/docusign.service";

test("buildEnvelopeResendRequest uses the envelope update endpoint with resend flag", () => {
  assert.deepEqual(buildEnvelopeResendRequest("env_123"), {
    endpoint: "/envelopes/env_123?resend_envelope=true",
    method: "PUT",
    body: {
      envelopeId: "env_123",
    },
  });
});

test("isContractResendableStatus only accepts in-flight contract states", () => {
  assert.equal(isContractResendableStatus("SENT_FOR_SIGNATURE"), true);
  assert.equal(isContractResendableStatus("VIEWED"), true);
  assert.equal(isContractResendableStatus("SIGNED"), false);
  assert.equal(isContractResendableStatus("VOIDED"), false);
});
