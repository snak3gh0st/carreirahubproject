import { queues } from "./queue";

/**
 * Webhook Queue Helpers
 *
 * Enqueues webhook processing jobs for async handling.
 * Webhooks should:
 * 1. Validate signature (sync)
 * 2. Store in WebhookEvent table (sync)
 * 3. Enqueue for processing (sync, fast)
 * 4. Return 200 OK immediately
 * 5. Queue processor handles actual work (async)
 */

export interface WebhookQueueJob {
  webhookEventId: string;
  service: string;
  eventType: string;
  payload: any;
  headers: any;
}

/**
 * Enqueue Pipedrive webhook for async processing
 */
export async function enqueuePipedriveWebhook(data: WebhookQueueJob): Promise<void> {
  await queues.pipedriveSync.add(
    "process-webhook",
    data,
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 60000, // 1 minute base delay
      },
      removeOnComplete: {
        age: 24 * 3600, // Keep for 24 hours
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Keep failures for 7 days
      },
    }
  );
}

/**
 * Enqueue QuickBooks webhook for async processing
 */
export async function enqueueQuickBooksWebhook(data: WebhookQueueJob): Promise<void> {
  await queues.quickbooksSync.add(
    "process-webhook",
    data,
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 60000, // 1 minute base delay
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    }
  );
}

/**
 * Enqueue DocuSign webhook for async processing
 */
export async function enqueueDocuSignWebhook(data: WebhookQueueJob): Promise<void> {
  await queues.contractGeneration.add(
    "process-webhook",
    data,
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 60000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    }
  );
}

/**
 * Enqueue Twilio/WhatsApp webhook for async processing
 */
export async function enqueueTwilioWebhook(data: WebhookQueueJob): Promise<void> {
  await queues.whatsappMessages.add(
    "process-webhook",
    data,
    {
      attempts: 5,
      backoff: {
        type: "exponential",
        delay: 60000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600,
      },
    }
  );
}
