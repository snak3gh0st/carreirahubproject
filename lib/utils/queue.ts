import { Queue, Worker, QueueEvents } from "bullmq";

/**
 * Queue Service (BullMQ)
 *
 * Responsabilidade: Gerenciar filas de processamento assíncrono e retry automático
 */

/**
 * Validates if Redis is properly configured with a real hostname
 *
 * Returns { configured: true } if Redis URL is valid and resolvable
 * Returns { configured: false, reason: string } if Redis URL is missing, invalid, or uses placeholder hostname
 */
export function isRedisConfigured(): { configured: boolean; reason?: string } {
  // Check if REDIS_URL exists
  if (!process.env.REDIS_URL) {
    return { configured: false, reason: "REDIS_URL environment variable not set" };
  }

  // Try to parse as URL
  let url: URL;
  try {
    url = new URL(process.env.REDIS_URL);
  } catch {
    return { configured: false, reason: `Invalid REDIS_URL format: ${process.env.REDIS_URL}` };
  }

  // Check for placeholder hostnames (common patterns)
  const hostname = url.hostname.toLowerCase();
  const placeholderPatterns = [
    "placeholder",
    "your-redis-host",
    "redis-host",
    "example.com",
    "example",
    ""
  ];

  for (const pattern of placeholderPatterns) {
    if (hostname === pattern || hostname.includes("placeholder") || hostname.includes("example")) {
      return {
        configured: false,
        reason: `REDIS_URL uses placeholder hostname: ${url.hostname}`
      };
    }
  }

  // Validate port is valid number
  const port = parseInt(url.port || "6379");
  if (isNaN(port) || port < 1 || port > 65535) {
    return { configured: false, reason: `Invalid port in REDIS_URL: ${url.port}` };
  }

  // Empty hostname check
  if (!url.hostname || url.hostname.trim() === "") {
    return { configured: false, reason: "REDIS_URL has empty hostname" };
  }

  return { configured: true };
}

// Configuração do Redis (usando connection options ao invés de instância)
function getConnectionOptions() {
  // Only parse Redis URL at runtime, not build time
  if (!process.env.REDIS_URL) {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }

  try {
    const url = new URL(process.env.REDIS_URL);

    // Validate hostname is not a placeholder
    const validation = isRedisConfigured();
    if (!validation.configured) {
      console.warn(`[QUEUE] ${validation.reason}. Falling back to localhost.`);
      return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
    }

    return {
      host: url.hostname,
      port: parseInt(url.port || "6379"),
      username: url.username || undefined,
      password: url.password || undefined,
      connectTimeout: 5000,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }
}

// Lazy queue initialization - queues are only created when first accessed
let _queues: any = null;
let _queueEvents: any = null;

function initQueues() {
  if (_queues) return _queues;

  const connectionOptions = getConnectionOptions();

  _queues = {
    leadQualification: new Queue("lead-qualification", { connection: connectionOptions }),
    whatsappMessages: new Queue("whatsapp-messages", { connection: connectionOptions }),
    invoiceGeneration: new Queue("invoice-generation", { connection: connectionOptions }),
    invoiceApproval: new Queue("invoice-approval", { connection: connectionOptions }),
    contractGeneration: new Queue("contract-generation", { connection: connectionOptions }),
    quickbooksSync: new Queue("quickbooks-sync", { connection: connectionOptions }),
    bulkImport: new Queue("bulk-import", { connection: connectionOptions }),
  };

  return _queues;
}

function initQueueEvents() {
  if (_queueEvents) return _queueEvents;

  const connectionOptions = getConnectionOptions();

  _queueEvents = {
    leadQualification: new QueueEvents("lead-qualification", { connection: connectionOptions }),
    whatsappMessages: new QueueEvents("whatsapp-messages", { connection: connectionOptions }),
    invoiceGeneration: new QueueEvents("invoice-generation", { connection: connectionOptions }),
    invoiceApproval: new QueueEvents("invoice-approval", { connection: connectionOptions }),
    contractGeneration: new QueueEvents("contract-generation", { connection: connectionOptions }),
    quickbooksSync: new QueueEvents("quickbooks-sync", { connection: connectionOptions }),
    bulkImport: new QueueEvents("bulk-import", { connection: connectionOptions }),
  };

  return _queueEvents;
}

// Export getters instead of direct objects
export const queues = new Proxy({} as any, {
  get(_, prop) {
    return initQueues()[prop];
  }
});

export const queueEvents = new Proxy({} as any, {
  get(_, prop) {
    return initQueueEvents()[prop];
  }
});

/**
 * Adicionar job à fila de qualificação de leads
 */
export async function addLeadQualificationJob(leadId: string): Promise<void> {
  await queues.leadQualification.add(
    "qualify-lead",
    { leadId },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Manter por 24 horas
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Manter falhas por 7 dias
      },
    }
  );
}

/**
 * Adicionar job à fila de mensagens WhatsApp
 */
export async function addWhatsAppMessageJob(data: {
  phone: string;
  message: string;
  leadId?: string;
}): Promise<void> {
  await queues.whatsappMessages.add(
    "send-message",
    data,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    }
  );
}

/**
 * Adicionar job à fila de geração de invoice
 */
export async function addInvoiceGenerationJob(data: {
  dealId: string;
  customerId: string;
  amount: number;
  currency?: string;
}): Promise<void> {
  await queues.invoiceGeneration.add(
    "generate-invoice",
    data,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    }
  );
}

/**
 * Adicionar job à fila de geração de contrato
 */
export async function addContractGenerationJob(data: {
  dealId: string;
  customerId: string;
  customerEmail: string;
  customerName: string;
}): Promise<void> {
  await queues.contractGeneration.add(
    "generate-contract",
    data,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    }
  );
}

/**
 * Adicionar job à fila de sincronização QuickBooks
 */
export async function addQuickBooksSyncJob(data: {
  syncCustomers?: boolean;
  syncInvoices?: boolean;
  syncPayments?: boolean;
  syncItems?: boolean;
  maxResults?: number;
  incremental?: boolean;
}): Promise<void> {
  await queues.quickbooksSync.add(
    "sync-quickbooks",
    data,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 3600, // Manter por 24 horas
        count: 1000,
      },
      removeOnFail: {
        age: 7 * 24 * 3600, // Manter falhas por 7 dias
      },
    }
  );
}

/**
 * Add job to invoice approval queue
 */
export async function addInvoiceApprovalJob(data: {
  invoiceId: string;
  action: 'submit' | 'approve' | 'reject';
  userId: string;
  reason?: string;
}): Promise<void> {
  await queues.invoiceApproval.add(
    "invoice-approval",
    data,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 2000,
      },
    }
  );
}

/**
 * Add job to bulk import queue
 */
export async function addBulkImportJob(data: {
  importId: string;
  source: 'QUICKBOOKS';
  type: string;
  options?: any;
}): Promise<void> {
  await queues.bulkImport.add(
    "bulk-import",
    data,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 100,
      },
    }
  );
}

/**
 * Inicializar workers (deve ser chamado em um processo separado ou no servidor)
 *
 * NOTE: Workers don't run on Vercel serverless!
 * =============================================
 * This function creates BullMQ workers, which require persistent processes.
 * Vercel functions timeout after 10 seconds, making workers non-functional
 * in production.
 *
 * SOLUTION: Queue processing handled by /api/cron/process-queue
 * This cron endpoint runs every 5 minutes and uses lib/utils/queue-processor.ts
 * to safely process jobs within the 10-second timeout limit.
 *
 * IN DEVELOPMENT: Workers can be useful for local testing with npm run dev
 * IN PRODUCTION: All job processing is via the cron endpoint
 */
export function initializeWorkers() {
  const connectionOptions = getConnectionOptions();

  // Worker para qualificação de leads
  new Worker(
    "lead-qualification",
    async (job) => {
      const { leadId } = job.data;
      const { sdrService } = await import("@/lib/services/sdr.service");
      await sdrService.processNewLead(leadId);
    },
    { connection: connectionOptions }
  );

  // Worker para mensagens WhatsApp
  new Worker(
    "whatsapp-messages",
    async (job) => {
      const { phone, message, leadId } = job.data;
      const { whatsappService } = await import("@/lib/services/whatsapp.service");
      await whatsappService.sendMessage(phone, message);
    },
    { connection: connectionOptions }
  );

  // Worker para geração de invoices
  new Worker(
    "invoice-generation",
    async (job) => {
      const { dealId, customerId, amount, currency } = job.data;
      // TODO: Implementar lógica de geração de invoice
      console.log(`Generating invoice for deal ${dealId}`);
    },
    { connection: connectionOptions }
  );

  // Worker para geração de contratos
  new Worker(
    "contract-generation",
    async (job) => {
      const { dealId, customerId, customerEmail, customerName } = job.data;
      // TODO: Implementar lógica de geração de contrato
      console.log(`Generating contract for deal ${dealId}`);
    },
    { connection: connectionOptions }
  );

  // Worker para sincronização QuickBooks
  new Worker(
    "quickbooks-sync",
    async (job) => {
      const { quickbooksSyncService } = await import("@/lib/services/quickbooks-sync.service");
      await quickbooksSyncService.sync(job.data);
    },
    { connection: connectionOptions }
  );

  // Worker for invoice approval workflow
  new Worker(
    "invoice-approval",
    async (job) => {
      const { invoiceId, action, userId, reason } = job.data;
      // Note: Approval workflow removed in quick-012, this queue processor is deprecated
      console.warn(`Invoice approval action '${action}' attempted but approval workflow has been removed`);
      return;
    },
    { connection: connectionOptions }
  );

  // Worker for bulk import
  new Worker(
    "bulk-import",
    async (job) => {
      const { importId, source, type } = job.data;

      if (source === "QUICKBOOKS") {
        const { quickbooksSyncService } = await import("@/lib/services/quickbooks-sync.service");

        // Parse type string to determine what to import
        const typeParts = type.split("_AND_");
        const importCustomers = typeParts.includes("CUSTOMERS");
        const importInvoices = typeParts.includes("INVOICES");

        if (importCustomers) {
          await quickbooksSyncService.importAllCustomers(importId);
        }

        if (importInvoices) {
          await quickbooksSyncService.importAllInvoices(importId);
        }

        // Mark as completed if this was the last import type
        if (importInvoices || !importCustomers) {
          const { prisma } = await import("@/lib/db");
          await prisma.bulkImport.update({
            where: { id: importId },
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
            },
          });
        }
      }
    },
    {
      connection: connectionOptions,
    }
  );
}

