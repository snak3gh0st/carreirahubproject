import assert from "node:assert/strict";
import test from "node:test";

import { getQueueProcessingOrder } from "@/lib/utils/queue-processor";

test("getQueueProcessingOrder prioritizes quickbooks webhooks before heavy sync work", () => {
  const order = getQueueProcessingOrder([
    "quickbooksSync",
    "quickbooksWebhook",
    "whatsappMessages",
    "bulkImport",
  ]);

  assert.deepEqual(order, [
    "quickbooksWebhook",
    "quickbooksSync",
    "whatsappMessages",
    "bulkImport",
  ]);
});

test("getQueueProcessingOrder ignores unknown queues and preserves supported priority order", () => {
  const order = getQueueProcessingOrder([
    "bulkImport",
    "unknown-queue" as never,
    "leadQualification",
    "quickbooksWebhook",
  ]);

  assert.deepEqual(order, [
    "quickbooksWebhook",
    "leadQualification",
    "bulkImport",
  ]);
});
