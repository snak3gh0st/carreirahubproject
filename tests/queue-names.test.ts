import assert from "node:assert/strict";
import test from "node:test";

import {
  ACTIVE_QUEUE_KEYS,
  QUEUE_NAMES,
  resolveBullQueueName,
} from "../lib/utils/queue-names";

test("maps logical queue keys to the BullMQ queue names used by producers", () => {
  assert.equal(resolveBullQueueName("quickbooksSync"), "quickbooks-sync");
  assert.equal(resolveBullQueueName("invoiceApproval"), "invoice-approval");
  assert.equal(resolveBullQueueName("whatsappMessages"), "whatsapp-messages");
});

test("does not monitor removed Pipedrive queues", () => {
  assert.equal(ACTIVE_QUEUE_KEYS.includes("pipedriveSync" as any), false);
  assert.equal(ACTIVE_QUEUE_KEYS.includes("pipedriveReverseSync" as any), false);
});

test("keeps every active queue mapped to a runtime BullMQ name", () => {
  for (const key of ACTIVE_QUEUE_KEYS) {
    assert.equal(resolveBullQueueName(key), QUEUE_NAMES[key]);
  }
});
