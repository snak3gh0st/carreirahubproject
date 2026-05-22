import test from "node:test";
import assert from "node:assert/strict";

import { buildOpsManualStudentCommunicationAlert } from "../lib/ops/internal-alerts";

test("buildOpsManualStudentCommunicationAlert marks student communication as manual only", () => {
  const alert = buildOpsManualStudentCommunicationAlert({
    customerId: "customer_1",
    customerName: "Student One",
    customerEmail: "student@example.com",
    title: "Formulario pendente",
    description: "Contato manual necessario.",
    dedupeKey: "form-reminder:assignment_1:1",
    data: { templateId: "entry" },
  });

  assert.equal(alert.customerId, "customer_1");
  assert.equal(alert.data.channelPolicy, "MANUAL_ONLY");
  assert.equal(alert.data.dedupeKey, "form-reminder:assignment_1:1");
  assert.equal(alert.data.templateId, "entry");
});
