import { Queue, Worker, QueueEvents } from "bullmq";

/**
 * Queue Service (BullMQ)
 *
 * Responsabilidade: Gerenciar filas de processamento assíncrono e retry automático
 */

// Configuração do Redis (usando connection options ao invés de instância)
function getConnectionOptions() {
  // Only parse Redis URL at runtime, not build time
  if (!process.env.REDIS_URL) {
    return { host: "localhost", port: 6379, maxRetriesPerRequest: null };
  }

  try {
    const url = new URL(process.env.REDIS_URL);
    return {
      host: url.hostname,
      port: parseInt(url.port || "6379"),
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
    pipedriveSync: new Queue("pipedrive-sync", { connection: connectionOptions }),
    pipedriveReverseSync: new Queue("pipedrive-reverse-sync", { connection: connectionOptions }),
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
    pipedriveSync: new QueueEvents("pipedrive-sync", { connection: connectionOptions }),
    pipedriveReverseSync: new QueueEvents("pipedrive-reverse-sync", { connection: connectionOptions }),
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
 * Adicionar job à fila de sincronização Pipedrive
 */
export async function addPipedriveSyncJob(data: {
  type: "person" | "deal";
  id: number;
}): Promise<void> {
  await queues.pipedriveSync.add(
    "sync-pipedrive",
    data,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000,
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
 * Add job to Pipedrive reverse sync queue (Hub → Pipedrive)
 */
export async function addPipedriveReverseSyncJob(data: {
  type: 'customer' | 'deal' | 'invoice';
  entityId: string;
}): Promise<void> {
  await queues.pipedriveReverseSync.add(
    "pipedrive-reverse-sync",
    data,
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 3000,
      },
      removeOnComplete: {
        age: 24 * 3600,
        count: 1000,
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
  source: 'PIPEDRIVE' | 'QUICKBOOKS';
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
 * Nota: Em produção, workers devem rodar em processos separados ou usar Vercel Cron Jobs
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

  // Worker para sincronização Pipedrive
  new Worker(
    "pipedrive-sync",
    async (job) => {
      const { type, id } = job.data;
      const { pipedriveService } = await import("@/lib/services/pipedrive.service");
      
      if (type === "person") {
        await pipedriveService.getPerson(id);
      } else if (type === "deal") {
        await pipedriveService.getDeal(id);
      }
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

  // Worker for Pipedrive reverse sync (Hub → Pipedrive)
  new Worker(
    "pipedrive-reverse-sync",
    async (job) => {
      const { type, entityId } = job.data;
      const { pipedriveSyncService } = await import("@/lib/services/pipedrive-sync.service");

      if (type === "customer") {
        await pipedriveSyncService.syncCustomerToPipedrive(entityId);
      } else if (type === "deal") {
        await pipedriveSyncService.syncDealToPipedrive(entityId);
      } else if (type === "invoice") {
        await pipedriveSyncService.syncInvoiceToPipedrive(entityId);
      }
    },
    {
      connection: connectionOptions,
    }
  );

  // Worker for invoice approval workflow
  new Worker(
    "invoice-approval",
    async (job) => {
      const { invoiceId, action, userId, reason } = job.data;
      const { invoiceApprovalService } = await import("@/lib/services/invoice-approval.service");

      if (action === "approve") {
        await invoiceApprovalService.approveInvoice(invoiceId, userId);
      } else if (action === "reject") {
        await invoiceApprovalService.rejectInvoice(invoiceId, userId, reason || "No reason provided");
      } else if (action === "submit") {
        await invoiceApprovalService.submitForApproval(invoiceId, userId);
      }
    },
    { connection: connectionOptions }
  );

  // Worker for bulk import
  new Worker(
    "bulk-import",
    async (job) => {
      const { importId, source, type } = job.data;

      if (source === "PIPEDRIVE") {
        const { pipedriveSyncService } = await import("@/lib/services/pipedrive-sync.service");

        if (type === "PERSONS" || type === "PERSONS_AND_DEALS") {
          await pipedriveSyncService.importAllPersons(importId);
        }

        if (type === "DEALS" || type === "PERSONS_AND_DEALS") {
          await pipedriveSyncService.importAllDeals(importId);
        }
      } else if (source === "QUICKBOOKS") {
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

