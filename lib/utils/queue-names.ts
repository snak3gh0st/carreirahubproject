export const QUEUE_NAMES = {
  leadQualification: "lead-qualification",
  whatsappMessages: "whatsapp-messages",
  invoiceGeneration: "invoice-generation",
  invoiceApproval: "invoice-approval",
  contractGeneration: "contract-generation",
  quickbooksSync: "quickbooks-sync",
  bulkImport: "bulk-import",
} as const;

export type QueueKey = keyof typeof QUEUE_NAMES;

export const ACTIVE_QUEUE_KEYS = Object.keys(QUEUE_NAMES) as QueueKey[];

export function resolveBullQueueName(queueName: string) {
  return QUEUE_NAMES[queueName as QueueKey] ?? queueName;
}
