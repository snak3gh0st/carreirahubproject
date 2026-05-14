/**
 * QuickBooks Sync Service
 * 
 * Responsabilidade: Sincronização automática de dados do QuickBooks
 * 
 * Este serviço gerencia a sincronização periódica de:
 * - Customers
 * - Invoices
 * - Payments
 * - Items
 */

import { quickbooksService } from "./quickbooks.service";
import { identityMapper } from "./identity-mapper";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { extractQuickbooksInvoiceLink } from "@/lib/quickbooks/invoice-link";
import { buildQbHistoryStartDate } from "@/lib/financial/qb-window";
import { parseLocalDate } from "@/lib/utils/date";
import {
  collectPaginatedQuickBooksRecords,
  findLinkedQuickBooksInvoiceId,
  chooseInvoiceSyncMatch,
  isQuickBooksInvoiceMarkedMissing,
  mergeQuickBooksInvoiceMetadata,
  resolveLocalCustomerIdForPayment,
} from "@/lib/quickbooks/sync-helpers";

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const HUB_LEGACY_RECEIVABLE_CUTOFF = buildQbHistoryStartDate();

function formatDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  return `${year}-${month}-${day}`;
}

function parseQuickBooksDueDate(dueDate?: string): Date {
  if (!dueDate) {
    return new Date();
  }

  const dateOnly = dueDate.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return parseLocalDate(dateOnly);
  }

  return new Date(dueDate);
}

function shouldExcludeOpenQuickBooksInvoiceFromHub(dueDate: Date, balance: number): boolean {
  return balance > 0 && dueDate < HUB_LEGACY_RECEIVABLE_CUTOFF;
}

async function triggerOperationalOnboardingForPaidInvoice(
  invoiceId: string,
  source: string
): Promise<void> {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        status: true,
        dealId: true,
        customer: {
          select: { id: true, name: true, email: true, phone: true },
        },
      },
    });

    if (!invoice || invoice.status !== "PAID" || !invoice.dealId) return;

    const signedContract = await prisma.contract.findFirst({
      where: { dealId: invoice.dealId, status: "SIGNED" },
      select: { id: true },
    });
    if (!signedContract) return;

    const { clintEventProcessor } = await import("@/lib/services/clint-event-processor.service");
    console.log(
      `[QuickBooks Sync] Contract SIGNED — triggering onboarding for deal ${invoice.dealId} (${source})`
    );
    await clintEventProcessor.triggerOnboarding(invoice.dealId, invoice.customer);
  } catch (error) {
    console.error("[QuickBooks Sync] Onboarding gate failed (non-blocking):", error);
  }
}

export interface SyncOptions {
  syncCustomers?: boolean;
  syncInvoices?: boolean;
  syncPayments?: boolean;
  syncItems?: boolean;
  syncPriceLevels?: boolean;
  syncPaymentTerms?: boolean;
  maxResults?: number;
  incremental?: boolean; // Sincronizar apenas novos/atualizados
}

export interface SyncResult {
  success: boolean;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  customers?: {
    total: number;
    synced: number;
    updated: number;
    errors: number;
    errorDetails?: Array<{ email: string; error: string }>;
  };
  invoices?: {
    total: number;
    synced: number;
    updated: number;
    errors: number;
    errorDetails?: Array<{ invoiceId: string; error: string }>;
  };
  payments?: {
    total: number;
    synced: number;
    errors: number;
  };
  items?: {
    total: number;
    synced: number;
    errors: number;
  };
  priceLevels?: {
    total: number;
    synced: number;
    errors: number;
  };
  paymentTerms?: {
    total: number;
    synced: number;
    errors: number;
  };
  companyInfo?: any;
  error?: string;
}

export class QuickBooksSyncService {
  /**
   * Batch size for processing items to avoid connection pool exhaustion.
   * After each batch, a brief pause lets the pool reclaim connections.
   */
  private static readonly BATCH_SIZE = 25;
  private static readonly BATCH_PAUSE_MS = 100;

  /**
   * Process items in batches to reduce sustained connection pool pressure.
   * Pauses briefly between batches to let the pool release connections.
   */
  private async processBatch<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = QuickBooksSyncService.BATCH_SIZE,
  ): Promise<R[]> {
    const results: R[] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      for (const item of batch) {
        results.push(await processor(item));
      }
      // Brief pause between batches to let the connection pool breathe
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, QuickBooksSyncService.BATCH_PAUSE_MS));
      }
    }
    return results;
  }

  private async reconcileInvoiceIdentityDrift(qbInvoices: any[]): Promise<{
    relinkedByDocNumber: number;
    markedMissingInQb: number;
    clearedMissingFlag: number;
  }> {
    const localInvoices = await prisma.invoice.findMany({
      where: { quickbooks_invoice_id: { not: null } },
      select: {
        id: true,
        invoiceNumber: true,
        quickbooks_invoice_id: true,
        installments: true,
      },
    });

    const qbById = new Map(qbInvoices.map((invoice) => [String(invoice.Id), invoice]));
    const qbByDocNumber = new Map(
      qbInvoices
        .filter((invoice) => invoice.DocNumber)
        .map((invoice) => [String(invoice.DocNumber), invoice]),
    );
    const localByQbId = new Map(
      localInvoices
        .filter((invoice) => invoice.quickbooks_invoice_id)
        .map((invoice) => [String(invoice.quickbooks_invoice_id), invoice]),
    );

    let relinkedByDocNumber = 0;
    let markedMissingInQb = 0;
    let clearedMissingFlag = 0;
    const nowIso = new Date().toISOString();

    for (const localInvoice of localInvoices) {
      const currentQbId = String(localInvoice.quickbooks_invoice_id);
      const hasDirectQbMatch = qbById.has(currentQbId);
      const currentlyMarkedMissing = isQuickBooksInvoiceMarkedMissing(localInvoice.installments);

      if (hasDirectQbMatch) {
        if (currentlyMarkedMissing) {
          await prisma.invoice.update({
            where: { id: localInvoice.id },
            data: {
              installments: mergeQuickBooksInvoiceMetadata(localInvoice.installments, {
                missingInQb: false,
                missingInQbAt: null,
              }) as Prisma.InputJsonValue,
            },
          });
          clearedMissingFlag += 1;
        }
        continue;
      }

      const qbDocMatch = localInvoice.invoiceNumber
        ? qbByDocNumber.get(String(localInvoice.invoiceNumber))
        : null;
      const targetQbId = qbDocMatch ? String(qbDocMatch.Id) : null;
      const conflictingLocal = targetQbId ? localByQbId.get(targetQbId) : null;

      if (qbDocMatch && (!conflictingLocal || conflictingLocal.id === localInvoice.id)) {
        await prisma.invoice.update({
          where: { id: localInvoice.id },
          data: {
            quickbooks_invoice_id: targetQbId,
            installments: mergeQuickBooksInvoiceMetadata(localInvoice.installments, {
              missingInQb: false,
              missingInQbAt: null,
              relinkedAt: nowIso,
              previousQuickbooksInvoiceId: currentQbId,
            }) as Prisma.InputJsonValue,
          },
        });
        localByQbId.delete(currentQbId);
        localByQbId.set(String(targetQbId), localInvoice);
        relinkedByDocNumber += 1;
        continue;
      }

      if (!currentlyMarkedMissing) {
        await prisma.invoice.update({
          where: { id: localInvoice.id },
          data: {
            installments: mergeQuickBooksInvoiceMetadata(localInvoice.installments, {
              missingInQb: true,
              missingInQbAt: nowIso,
              previousQuickbooksInvoiceId: currentQbId,
            }) as Prisma.InputJsonValue,
          },
        });
        markedMissingInQb += 1;
      }
    }

    return { relinkedByDocNumber, markedMissingInQb, clearedMissingFlag };
  }

  /**
   * Sync a single customer from QuickBooks by QB ID (for webhook processing)
   * Returns the local customer record after sync
   */
  async syncSingleCustomer(qbCustomerId: string): Promise<{
    success: boolean;
    customer?: any;
    isNew: boolean;
    error?: string;
  }> {
    try {
      await quickbooksService.initialize();

      // Fetch the customer from QuickBooks
      const qbResponse = await quickbooksService.getCustomerById(qbCustomerId);
      const qbCustomer = qbResponse.Customer;

      if (!qbCustomer) {
        return { success: false, isNew: false, error: "Customer not found in QuickBooks" };
      }

      const email = qbCustomer.PrimaryEmailAddr?.Address;
      const name = qbCustomer.DisplayName || qbCustomer.CompanyName || "Unknown";
      const phone = qbCustomer.PrimaryPhone?.FreeFormNumber;

      if (!email) {
        return { success: false, isNew: false, error: "Customer has no email" };
      }

      // Check if customer already exists
      const existing = await prisma.customer.findFirst({
        where: {
          OR: [
            { email },
            { quickbooks_id: qbCustomerId },
          ],
        },
      });

      // Reconcile customer via Identity Mapper
      const customer = await identityMapper.reconcileCustomer({
        email,
        name,
        phone,
        externalIds: { quickbooks_id: qbCustomerId },
        metadata: {
          quickbooks: {
            syncDate: new Date().toISOString(),
            companyName: qbCustomer.CompanyName,
            balance: qbCustomer.Balance,
            metaData: qbCustomer.MetaData,
          },
        },
      });

      // Update customer balance fields
      await prisma.customer.update({
        where: { id: customer.id },
        data: {
          qbBalance: qbCustomer.Balance || 0,
          lastQbBalanceSync: new Date(),
          lastQuickbooksSyncAt: new Date(),
        },
      });

      console.log(`[QuickBooks Sync] Customer ${qbCustomerId} synced: ${customer.id} (${existing ? 'updated' : 'new'})`);

      return {
        success: true,
        customer,
        isNew: !existing,
      };
    } catch (error: any) {
      console.error(`[QuickBooks Sync] Error syncing customer ${qbCustomerId}:`, error);
      return { success: false, isNew: false, error: error.message };
    }
  }

  /**
   * Sync a single invoice from QuickBooks by QB ID (for webhook processing)
   * Returns the local invoice record after sync
   */
  async syncSingleInvoice(qbInvoiceId: string): Promise<{
    success: boolean;
    invoice?: any;
    isNew: boolean;
    error?: string;
  }> {
    try {
      await quickbooksService.initialize();

      // Fetch the invoice from QuickBooks
      const qbResponse = await quickbooksService.getInvoice(qbInvoiceId);
      const qbInvoice = qbResponse.Invoice;

      if (!qbInvoice) {
        return { success: false, isNew: false, error: "Invoice not found in QuickBooks" };
      }

      const customerRef = qbInvoice.CustomerRef?.value;
      if (!customerRef) {
        return { success: false, isNew: false, error: "Invoice has no customer reference" };
      }

      // Find the customer by QB ID
      let customer = await prisma.customer.findFirst({
        where: { quickbooks_id: customerRef },
      });

      // If customer not found, try to sync them first
      if (!customer) {
        const customerSync = await this.syncSingleCustomer(customerRef);
        if (!customerSync.success) {
          return { success: false, isNew: false, error: `Customer sync failed: ${customerSync.error}` };
        }
        customer = customerSync.customer;
      }

      if (!customer) {
        return { success: false, isNew: false, error: `Customer ${customerRef} not found` };
      }

      // Map QuickBooks status to our status enum with enhanced logic
      let status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "PARTIALLY_PAID" | "VOID" = "SENT";
      const balance = qbInvoice.Balance || 0;
      const totalAmt = qbInvoice.TotalAmt || 0;
      const dueDate = parseQuickBooksDueDate(qbInvoice.DueDate);
      const dueDateKey = formatDateKeyInTimeZone(dueDate, BUSINESS_TIME_ZONE);
      const todayKey = formatDateKeyInTimeZone(new Date(), BUSINESS_TIME_ZONE);
      const quickbooksInvoiceLink = extractQuickbooksInvoiceLink(qbInvoice);
      const excludeFromHub = shouldExcludeOpenQuickBooksInvoiceFromHub(dueDate, balance);

      if (balance === 0) {
        status = "PAID";
      } else if (balance < totalAmt && balance > 0) {
        status = "PARTIALLY_PAID";
      } else if (dueDateKey < todayKey && balance > 0) {
        status = "OVERDUE";
      } else if (qbInvoice.EmailStatus === "EmailSent") {
        status = "SENT";
      }

      // Check if invoice exists
      const existing = await prisma.invoice.findUnique({
        where: { quickbooks_invoice_id: qbInvoiceId },
      });
      let invoice;

      if (excludeFromHub) {
        if (existing) {
          invoice = await prisma.invoice.update({
            where: { id: existing.id },
            data: {
              installments: mergeQuickBooksInvoiceMetadata(existing.installments, {
                syncDate: new Date().toISOString(),
                txnDate: qbInvoice.TxnDate,
                balance,
                totalAmt,
                emailStatus: qbInvoice.EmailStatus,
                excludedFromHub: true,
                excludedFromHubAt: new Date().toISOString(),
                exclusionReason: "legacy_overdue_pre_2025",
              }) as any,
            },
          });
          console.log(`[QuickBooks Sync] Archived legacy receivable ${qbInvoiceId} from hub view`);
          return { success: true, invoice, isNew: false };
        }

        console.log(`[QuickBooks Sync] Skipping legacy receivable ${qbInvoiceId} from hub import`);
        return { success: true, isNew: false };
      }

      // Get or create a default deal for this customer
      let deal = await prisma.deal.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
      });

      if (!deal) {
        // Generate a unique negative ID for QB-only deals using customer's QB ID
        // This avoids conflicts while keeping clint_deal_id unique
        const qbDealId = -Math.abs(parseInt(customerRef));

        deal = await prisma.deal.create({
          data: {
            customerId: customer.id,
            title: "QuickBooks Import",
            value: totalAmt,
            currency: "USD",
            status: "OPEN",
            clint_deal_id: String(qbDealId), // Unique negative ID for QB-only deals
          },
        });
      }

      if (existing) {
        // IMPORTANT: When updating an existing invoice, preserve locally-originated
        // fields (invoiceNumber, dueDate, installments, lineItems, dealId, ownerId)
        // and only update QB-sync fields (status, amountPaid, paidAt, markedOverdueAt).
        // This prevents the destructive overwrite that previously destroyed installment
        // series tracking and other local data set during invoice creation.
        const existingInstallments = (existing.installments as any) || {};
        const mergedInstallments = {
          ...existingInstallments,
          quickbooks: {
            syncDate: new Date().toISOString(),
            txnDate: qbInvoice.TxnDate,
            balance,
            totalAmt,
            emailStatus: qbInvoice.EmailStatus,
            excludedFromHub: false,
          },
        };

        invoice = await prisma.invoice.update({
          where: { id: existing.id },
          data: {
            // Only update status-related fields from QB
            status,
            amountPaid: balance === 0 ? totalAmt : balance < totalAmt && balance > 0 ? totalAmt - balance : 0,
            paidAt: balance < totalAmt && balance >= 0 ? (balance === 0 ? new Date(qbInvoice.TxnDate || new Date()) : new Date()) : null,
            markedOverdueAt: status === "OVERDUE" ? new Date() : existing.markedOverdueAt,
            ...(quickbooksInvoiceLink ? { quickbooks_invoice_link: quickbooksInvoiceLink } : {}),
            // Merge QB sync data into installments without overwriting local data
            installments: mergedInstallments as any,
            // Preserve existing: invoiceNumber, amount, dueDate, dealId, customerId, ownerId, lineItems
          },
        });
      } else {
        // New invoice from QB sync (not locally created) - set all fields
        const invoiceData = {
          invoiceNumber: qbInvoice.DocNumber || qbInvoiceId,
          amount: totalAmt,
          dueDate,
          status,
          quickbooks_invoice_id: qbInvoiceId,
          ...(quickbooksInvoiceLink ? { quickbooks_invoice_link: quickbooksInvoiceLink } : {}),
          dealId: deal.id,
          customerId: customer.id,
          markedOverdueAt: status === "OVERDUE" ? new Date() : null,
          amountPaid: balance === 0 ? totalAmt : balance < totalAmt && balance > 0 ? totalAmt - balance : 0,
          paidAt: balance < totalAmt && balance >= 0 ? (balance === 0 ? new Date(qbInvoice.TxnDate || new Date()) : new Date()) : null,
          installments: {
            quickbooks: {
              syncDate: new Date().toISOString(),
              txnDate: qbInvoice.TxnDate,
              balance,
              totalAmt,
              emailStatus: qbInvoice.EmailStatus,
              excludedFromHub: false,
            },
          } as any,
        };
        invoice = await prisma.invoice.create({
          data: invoiceData,
        });
      }

      console.log(`[QuickBooks Sync] Invoice ${qbInvoiceId} synced: ${invoice.id} (${existing ? 'updated' : 'new'}) - Status: ${status}`);
      if (status === "PAID" && existing?.status !== "PAID") {
        await triggerOperationalOnboardingForPaidInvoice(invoice.id, "syncSingleInvoice");
      }

      return {
        success: true,
        invoice,
        isNew: !existing,
      };
    } catch (error: any) {
      console.error(`[QuickBooks Sync] Error syncing invoice ${qbInvoiceId}:`, error);
      return { success: false, isNew: false, error: error.message };
    }
  }

  /**
   * Sync a single payment from QuickBooks by QB ID (for webhook processing)
   * Creates/updates Payment record and updates invoice status
   */
  async syncSinglePayment(qbPaymentId: string): Promise<{
    success: boolean;
    payment?: any;
    isNew: boolean;
    invoiceUpdated?: boolean;
    error?: string;
  }> {
    try {
      await quickbooksService.initialize();

      // Fetch the payment from QuickBooks
      const query = `SELECT * FROM Payment WHERE Id = '${qbPaymentId}'`;
      const result = await (quickbooksService as any).request(`/query?query=${encodeURIComponent(query)}`);
      const payments = result.QueryResponse?.Payment || [];
      const qbPayment = Array.isArray(payments) ? payments[0] : payments;

      if (!qbPayment) {
        return { success: false, isNew: false, error: "Payment not found in QuickBooks" };
      }

      const customerRef = qbPayment.CustomerRef?.value;
      if (!customerRef) {
        return { success: false, isNew: false, error: "Payment has no customer reference" };
      }

      // Find the customer by QB ID
      const customer = await prisma.customer.findFirst({
        where: { quickbooks_id: customerRef },
      });

      if (!customer) {
        // Try to sync customer first
        const customerSync = await this.syncSingleCustomer(customerRef);
        if (!customerSync.success) {
          return { success: false, isNew: false, error: `Customer not found: ${customerRef}` };
        }
      }

      const customerId = customer?.id || (await prisma.customer.findFirst({
        where: { quickbooks_id: customerRef },
      }))?.id;

      if (!customerId) {
        return { success: false, isNew: false, error: `Customer ${customerRef} not found after sync` };
      }

      // Find linked invoices from the payment
      const linkedInvoices = qbPayment.Line?.filter((line: any) =>
        line.LinkedTxn?.some((txn: any) => txn.TxnType === "Invoice")
      ) || [];

      let invoiceUpdated = false;
      let linkedInvoiceId: string | null = null;

      // Process linked invoices
      for (const line of linkedInvoices) {
        const linkedTxn = line.LinkedTxn?.find((txn: any) => txn.TxnType === "Invoice");
        if (linkedTxn) {
          const qbInvoiceId = linkedTxn.TxnId;

          // Find or sync the invoice
          let invoice = await prisma.invoice.findUnique({
            where: { quickbooks_invoice_id: qbInvoiceId },
          });

          if (!invoice) {
            // Sync the invoice first
            const invoiceSync = await this.syncSingleInvoice(qbInvoiceId);
            if (invoiceSync.success) {
              invoice = invoiceSync.invoice;
            }
          }

          if (invoice) {
            linkedInvoiceId = invoice.id;

            // Sync the invoice to get latest balance (which reflects this payment)
            const invoiceSync = await this.syncSingleInvoice(qbInvoiceId);
            if (invoiceSync.success) {
              invoiceUpdated = true;
            }
          }
        }
      }

      if (!linkedInvoiceId) {
        // If no linked invoice, find the most recent unpaid invoice for this customer
        const openInvoice = await prisma.invoice.findFirst({
          where: {
            customerId,
            status: { in: ["SENT", "OVERDUE", "PARTIALLY_PAID"] },
          },
          orderBy: { dueDate: "asc" },
        });

        if (openInvoice) {
          linkedInvoiceId = openInvoice.id;
        } else {
          return { success: false, isNew: false, error: "No invoice found to link payment" };
        }
      }

      // Check if payment already exists
      const existingPayment = await prisma.payment.findUnique({
        where: { quickbooks_payment_id: qbPaymentId },
      });

      const paymentData = {
        amount: qbPayment.TotalAmt || 0,
        currency: "USD",
        paymentDate: qbPayment.TxnDate ? new Date(qbPayment.TxnDate) : new Date(),
        paymentMethod: "quickbooks",
        referenceNumber: qbPayment.PaymentRefNum || qbPaymentId,
        quickbooks_payment_id: qbPaymentId,
        invoiceId: linkedInvoiceId,
        customerId,
        syncedFromQb: true,
        lastSyncAt: new Date(),
        metadata: {
          quickbooks: {
            syncDate: new Date().toISOString(),
            paymentData: qbPayment,
          },
        } as any,
      };

      const payment = await prisma.payment.upsert({
        where: { quickbooks_payment_id: qbPaymentId },
        update: paymentData,
        create: paymentData,
      });

      // Update customer balance
      await this.updateCustomerBalance(customerId);

      console.log(`[QuickBooks Sync] Payment ${qbPaymentId} synced: ${payment.id} (${existingPayment ? 'updated' : 'new'})`);

      return {
        success: true,
        payment,
        isNew: !existingPayment,
        invoiceUpdated,
      };
    } catch (error: any) {
      console.error(`[QuickBooks Sync] Error syncing payment ${qbPaymentId}:`, error);
      return { success: false, isNew: false, error: error.message };
    }
  }

  /**
   * Update customer's balance summary from their invoices and payments
   */
  async updateCustomerBalance(customerId: string): Promise<void> {
    try {
      // Calculate totals from invoices
      const invoiceStats = await prisma.invoice.aggregate({
        where: { customerId },
        _sum: { amount: true, amountPaid: true },
      });

      // Calculate total paid from payments
      const paymentStats = await prisma.payment.aggregate({
        where: { customerId },
        _sum: { amount: true },
      });

      const totalInvoiced = Number(invoiceStats._sum.amount || 0);
      const totalPaid = Number(paymentStats._sum.amount || invoiceStats._sum.amountPaid || 0);
      const balance = totalInvoiced - totalPaid;

      await prisma.customer.update({
        where: { id: customerId },
        data: {
          qbTotalInvoiced: totalInvoiced,
          qbTotalPaid: totalPaid,
          qbBalance: Math.max(0, balance),
          lastQbBalanceSync: new Date(),
        },
      });

      console.log(`[QuickBooks Sync] Customer ${customerId} balance updated: $${balance.toFixed(2)}`);
    } catch (error) {
      console.error(`[QuickBooks Sync] Error updating customer balance:`, error);
    }
  }

  /**
   * Sincronização completa do QuickBooks
   */
  async sync(options: SyncOptions = {}): Promise<SyncResult> {
    const {
      syncCustomers = true,
      syncInvoices = true,
      syncPayments = false,
      syncItems = true,
      syncPriceLevels = true,
      syncPaymentTerms = true,
      maxResults = 1000,
      incremental = false,
    } = options;

    const startTime = new Date();
    const result: SyncResult = {
      success: false,
      startTime,
    };

    try {
      // Initialize QuickBooks service to load tokens from database
      await quickbooksService.initialize();

      // 1. Sincronizar Customers
      if (syncCustomers) {
        result.customers = await this.syncCustomers(maxResults, incremental);
      }

      // 2. Sincronizar Invoices
      if (syncInvoices) {
        result.invoices = await this.syncInvoices(maxResults, incremental);
      }

      // 3. Sincronizar Payments (se necessário)
      if (syncPayments) {
        result.payments = await this.syncPayments(maxResults);
      }

      // 4. Sincronizar Items (se necessário)
      if (syncItems) {
        result.items = await this.syncItems(maxResults);
      }

      // 5. Sincronizar Price Levels (se necessário)
      if (syncPriceLevels) {
        result.priceLevels = await this.syncPriceLevels(maxResults);
      }

      // 6. Sincronizar Payment Terms (se necessário)
      if (syncPaymentTerms) {
        result.paymentTerms = await this.syncPaymentTerms(maxResults);
      }

      // 7. Buscar Company Info
      try {
        const companyInfo = await quickbooksService.getCompanyInfo();
        result.companyInfo = {
          companyName: companyInfo.CompanyInfo?.CompanyName,
          legalName: companyInfo.CompanyInfo?.LegalName,
          companyAddr: companyInfo.CompanyInfo?.CompanyAddr,
        };
      } catch (error) {
        console.error("[QuickBooks Sync] Error fetching company info:", error);
      }

      const endTime = new Date();
      result.endTime = endTime;
      result.duration = endTime.getTime() - startTime.getTime();
      result.success = true;

      // Log da sincronização
      await this.logSync(result);

      return result;
    } catch (error: any) {
      const endTime = new Date();
      result.endTime = endTime;
      result.duration = endTime.getTime() - startTime.getTime();
      result.error = error.message || "Unknown error";

      await this.logSync(result, error);

      throw error;
    }
  }

  /**
   * Sincronizar Customers
   */
  private async syncCustomers(
    maxResults: number,
    incremental: boolean
  ): Promise<SyncResult["customers"]> {
    try {
      // Fetch ALL customers with pagination (QB API limits to 1000 per request)
      let allCustomers: any[] = [];
      let startPosition = 1;
      let hasMore = true;
      let pageCount = 0;

      console.log("[QuickBooks Sync] Starting customer sync with pagination");

      while (hasMore) {
        const result = await quickbooksService.getAllCustomersPaginated({ startPosition });
        allCustomers = allCustomers.concat(result.customers);
        hasMore = result.hasMore;
        startPosition = result.nextPosition;
        pageCount++;

        console.log(`[QuickBooks Sync] Page ${pageCount}: fetched ${result.customers.length} customers, total: ${allCustomers.length}, hasMore: ${hasMore}`);
      }

      console.log(`[QuickBooks Sync] Completed fetching customers: ${allCustomers.length} total across ${pageCount} pages`);

      const qbCustomers = allCustomers;

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ email: string; error: string }> = [];

      // Process customers in batches to avoid connection pool exhaustion
      await this.processBatch(qbCustomers, async (qbCustomer) => {
        try {
          const email = qbCustomer.PrimaryEmailAddr?.Address;
          const name = qbCustomer.DisplayName || qbCustomer.CompanyName || "Unknown";
          const phone = qbCustomer.PrimaryPhone?.FreeFormNumber;

          if (!email) {
            errors.push({ email: "N/A", error: "Customer sem email" });
            return;
          }

          // Se incremental, verificar se ja existe e se precisa atualizar
          if (incremental) {
            const existing = await prisma.customer.findFirst({
              where: {
                OR: [
                  { email },
                  { quickbooks_id: qbCustomer.Id },
                ],
              },
            });

            // Verificar se precisa atualizar (comparar ultima modificacao)
            if (existing && existing.quickbooks_id === qbCustomer.Id) {
              const lastSync = existing.metadata as any;
              const lastSyncTime = lastSync?.quickbooks?.syncDate
                ? new Date(lastSync.quickbooks.syncDate)
                : null;

              // Se o customer foi modificado recentemente no QuickBooks
              const qbMetaUpdated = qbCustomer.MetaData?.LastUpdatedTime;
              if (qbMetaUpdated && lastSyncTime) {
                const qbUpdated = new Date(qbMetaUpdated);
                if (qbUpdated <= lastSyncTime) {
                  // Ja sincronizado, pular
                  return;
                }
              }
            }
          }

          const existingByEmail = await prisma.customer.findUnique({
            where: { email },
          });

          // If no match by email, check by quickbooks_id to prevent unique constraint
          // collision during create (QB customer may have changed email since last sync).
          if (!existingByEmail) {
            const existingByQbId = await prisma.customer.findUnique({
              where: { quickbooks_id: qbCustomer.Id },
            });
            if (existingByQbId) {
              // Customer already exists under a different email - update it in place
              // to reflect the new email from QB without creating a duplicate.
              const qbMetadata = {
                syncDate: new Date().toISOString(),
                companyName: qbCustomer.CompanyName,
                balance: qbCustomer.Balance,
                metaData: qbCustomer.MetaData,
              };
              const currentMetadata = (existingByQbId.metadata as any) || {};
              await prisma.customer.update({
                where: { id: existingByQbId.id },
                data: {
                  email,
                  name,
                  ...(phone ? { phone } : {}),
                  qbBalance: qbCustomer.Balance || 0,
                  lastQbBalanceSync: new Date(),
                  lastQuickbooksSyncAt: new Date(),
                  metadata: { ...currentMetadata, quickbooks: qbMetadata } as any,
                },
              });
              updated.push(existingByQbId.id);
              return;
            }
          }

          const customer = await identityMapper.reconcileCustomer({
            email,
            name,
            phone,
            externalIds: { quickbooks_id: qbCustomer.Id },
            metadata: {
              quickbooks: {
                syncDate: new Date().toISOString(),
                companyName: qbCustomer.CompanyName,
                balance: qbCustomer.Balance,
                metaData: qbCustomer.MetaData,
              },
            },
          });

          if (existingByEmail) {
            updated.push(customer.id);
          } else {
            synced.push(customer.id);
          }
        } catch (error: any) {
          errors.push({
            email: qbCustomer.PrimaryEmailAddr?.Address || "N/A",
            error: error.message,
          });
        }
      });

      return {
        total: qbCustomers.length,
        synced: synced.length,
        updated: updated.length,
        errors: errors.length,
      };
    } catch (error: any) {
      console.error("[QuickBooks Sync] Error syncing customers:", error);
      throw error;
    }
  }

  /**
   * Sincronizar Invoices
   */
  private async syncInvoices(
    maxResults: number,
    incremental: boolean
  ): Promise<SyncResult["invoices"]> {
    try {
      // Fetch ALL invoices with pagination (QB API limits to 1000 per request)
      let allInvoices: any[] = [];
      let startPosition = 1;
      let hasMore = true;
      let pageCount = 0;

      console.log("[QuickBooks Sync] Starting invoice sync with pagination");

      while (hasMore) {
        const result = await quickbooksService.getAllInvoicesPaginated({ startPosition });
        allInvoices = allInvoices.concat(result.invoices);
        hasMore = result.hasMore;
        startPosition = result.nextPosition;
        pageCount++;

        console.log(`[QuickBooks Sync] Page ${pageCount}: fetched ${result.invoices.length} invoices, total: ${allInvoices.length}, hasMore: ${hasMore}`);
      }

      console.log(`[QuickBooks Sync] Completed fetching invoices: ${allInvoices.length} total across ${pageCount} pages`);

      const qbInvoices = allInvoices;

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ invoiceId: string; error: string }> = [];

      // Process invoices in batches to avoid connection pool exhaustion
      await this.processBatch(qbInvoices, async (qbInvoice) => {
        try {
          const qbInvoiceId = qbInvoice.Id;
          const customerRef = qbInvoice.CustomerRef?.value;

          if (!customerRef) {
            errors.push({
              invoiceId: qbInvoiceId,
              error: "Invoice sem customer",
            });
            return;
          }

          // Se incremental, verificar se precisa atualizar
          // Nota: Invoice nao tem campo metadata, entao sempre sincronizamos

          const customer = await prisma.customer.findFirst({
            where: { quickbooks_id: customerRef },
          });

          if (!customer) {
            errors.push({
              invoiceId: qbInvoiceId,
              error: `Customer ${customerRef} nao encontrado`,
            });
            return;
          }

          const totalAmount = qbInvoice.TotalAmt || qbInvoice.Balance || 0;
          const qbStatus =
            qbInvoice.Balance === 0
              ? "PAID"
              : qbInvoice.Balance === qbInvoice.TotalAmt
              ? "SENT"
              : qbInvoice.Balance > 0
              ? "OVERDUE"
              : "DRAFT";

          const existing = await prisma.invoice.findUnique({
            where: { quickbooks_invoice_id: qbInvoiceId },
          });

          // Get or create a default deal for this customer
          let latestDeal = await prisma.deal.findFirst({
            where: { customerId: customer.id },
            orderBy: { createdAt: "desc" },
          });

          if (!latestDeal) {
            // Generate a unique negative ID for QB-only deals using customer's QB ID
            const qbDealId = -Math.abs(parseInt(customerRef));

            // Create default deal for QB-imported invoices (like syncSingleInvoice does)
            latestDeal = await prisma.deal.create({
              data: {
                customerId: customer.id,
                title: "QuickBooks Import",
                value: totalAmount,
                currency: "USD",
                status: "OPEN",
                clint_deal_id: String(qbDealId), // Unique negative ID for QB-only deals
              },
            });
            console.log(`[QuickBooks Sync] Created default deal for customer ${customer.id}: ${latestDeal.id}`);
          }

          // Nota: Invoice nao tem campo metadata, salvamos dados extras no installments (Json)
          const balance = qbInvoice.Balance || 0;
          const amountPaid = balance === 0 ? totalAmount : balance < totalAmount && balance > 0 ? totalAmount - balance : 0;
          const paidAt = amountPaid > 0 ? new Date(qbInvoice.TxnDate || new Date()) : null;
          const quickbooksInvoiceLink = extractQuickbooksInvoiceLink(qbInvoice);
          const dueDate = parseQuickBooksDueDate(qbInvoice.DueDate);
          const excludeFromHub = shouldExcludeOpenQuickBooksInvoiceFromHub(dueDate, balance);

          if (excludeFromHub) {
            if (existing) {
              await prisma.invoice.update({
                where: { id: existing.id },
                data: {
                  installments: mergeQuickBooksInvoiceMetadata(existing.installments, {
                    syncDate: new Date().toISOString(),
                    txnDate: qbInvoice.TxnDate,
                    balance: qbInvoice.Balance,
                    totalAmt: qbInvoice.TotalAmt,
                    excludedFromHub: true,
                    excludedFromHubAt: new Date().toISOString(),
                    exclusionReason: "legacy_overdue_pre_2025",
                  }) as any,
                },
              });
              updated.push(existing.id);
            }
            return;
          }

          const invoiceData = {
            invoiceNumber: qbInvoice.DocNumber || undefined,
            amount: totalAmount,
            dueDate,
            status: qbStatus as any,
            quickbooks_invoice_id: qbInvoiceId,
            ...(quickbooksInvoiceLink ? { quickbooks_invoice_link: quickbooksInvoiceLink } : {}),
            dealId: latestDeal.id,
            customerId: customer.id,
            amountPaid,
            paidAt,
            installments: {
              quickbooks: {
                syncDate: new Date().toISOString(),
                txnDate: qbInvoice.TxnDate,
                balance: qbInvoice.Balance,
                totalAmt: qbInvoice.TotalAmt,
                excludedFromHub: false,
              },
            } as any,
          };

          const docNumberMatch = qbInvoice.DocNumber
            ? await prisma.invoice.findFirst({
                where: {
                  invoiceNumber: qbInvoice.DocNumber,
                  customerId: customer.id,
                },
              })
            : null;

          // Check for a DRAFT invoice from a recurring template that matches this QB invoice.
          // When QB auto-creates an installment, our DRAFT record has no QB ID yet.
          // Match by: same customer + same amount (±$1) + due date within 5 days.
          const draftMatch = customer ? await prisma.invoice.findFirst({
            where: {
              customerId: customer.id,
              status: "DRAFT",
              quickbooks_invoice_id: null,
              amount: { gte: totalAmount - 1, lte: totalAmount + 1 },
              dueDate: {
                gte: new Date(dueDate.getTime() - 5 * 86400000),
                lte: new Date(dueDate.getTime() + 5 * 86400000),
              },
            },
            orderBy: { dueDate: "asc" },
          }) : null;

          const syncMatch = chooseInvoiceSyncMatch({
            existingByQuickBooksId: existing,
            existingByDocNumber: docNumberMatch,
            draftFallback: draftMatch,
          });

          if (syncMatch) {
            // Do NOT update invoiceNumber on an existing record - it may belong to a
            // locally-created invoice with a different number, and updating would hit the
            // unique constraint if another row already owns that DocNumber.
            const { invoiceNumber: _ignored, ...invoiceUpdateData } = invoiceData;
            await prisma.invoice.update({
              where: { id: syncMatch.record.id },
              data: invoiceUpdateData,
            });
            updated.push(syncMatch.record.id);
            if (syncMatch.strategy === "doc_number") {
              console.log(`[QuickBooks Sync] Re-linked invoice ${syncMatch.record.id} by DocNumber ${qbInvoice.DocNumber} to QB invoice ${qbInvoiceId}`);
            } else if (syncMatch.strategy === "draft") {
              console.log(`[QuickBooks Sync] Linked DRAFT invoice ${syncMatch.record.id} to QB invoice ${qbInvoiceId}`);
            }
            if (qbStatus === "PAID" && syncMatch.record.status !== "PAID") {
              await triggerOperationalOnboardingForPaidInvoice(syncMatch.record.id, "syncInvoices");
            }
          } else {
            const invoice = await prisma.invoice.create({
              data: invoiceData,
            });
            synced.push(invoice.id);
            if (qbStatus === "PAID") {
              await triggerOperationalOnboardingForPaidInvoice(invoice.id, "syncInvoices");
            }
          }
        } catch (error: any) {
          errors.push({
            invoiceId: qbInvoice.Id || "N/A",
            error: error.message,
          });
        }
      });

      const reconciliation = await this.reconcileInvoiceIdentityDrift(qbInvoices);
      console.log("[QuickBooks Sync] Invoice reconciliation summary:", reconciliation);

      return {
        total: qbInvoices.length,
        synced: synced.length,
        updated: updated.length + reconciliation.relinkedByDocNumber + reconciliation.clearedMissingFlag,
        errors: errors.length,
      };
    } catch (error: any) {
      console.error("[QuickBooks Sync] Error syncing invoices:", error);
      throw error;
    }
  }

  /**
   * Sync payments from QB to Hub (existing implementation)
   */
  private async syncPayments(maxResults: number): Promise<SyncResult["payments"]> {
    try {
      const qbPayments = maxResults >= 1000
        ? await collectPaginatedQuickBooksRecords((startPosition) =>
            quickbooksService.getAllPaymentsPaginated({ startPosition }).then((result) => ({
              records: result.payments,
              hasMore: result.hasMore,
              nextPosition: result.nextPosition,
            }))
          )
        : await quickbooksService.getAllPayments(maxResults);

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ paymentId: string; error: string }> = [];

      for (const qbPayment of qbPayments) {
        try {
          const qbPaymentId = qbPayment.Id;
          const invoiceRef = findLinkedQuickBooksInvoiceId(qbPayment);

          if (!invoiceRef) {
            console.warn(`[QB Sync] Payment ${qbPaymentId} has no linked invoice`);
            continue;
          }

          // Find the invoice by QB ID
          const invoice = await prisma.invoice.findFirst({
            where: { quickbooks_invoice_id: invoiceRef },
            include: { customer: true },
          });

          if (!invoice) {
            errors.push({
              paymentId: qbPaymentId,
              error: `Invoice ${invoiceRef} not found`,
            });
            continue;
          }

          // Check if payment already exists
          const existingPayment = await prisma.payment.findFirst({
            where: { quickbooks_payment_id: qbPaymentId },
          });

          const paymentData = {
            amount: qbPayment.TotalAmt || 0,
            currency: 'USD',
            paymentDate: qbPayment.TxnDate ? new Date(qbPayment.TxnDate) : new Date(),
            paymentMethod: 'QuickBooks',
            referenceNumber: qbPayment.DocNumber,
            quickbooks_payment_id: qbPaymentId,
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            syncedFromQb: true,
            metadata: {
              quickbooksPaymentData: qbPayment,
            } as any,
          };

          if (existingPayment) {
            await prisma.payment.update({
              where: { id: existingPayment.id },
              data: paymentData,
            });
            updated.push(existingPayment.id);
          } else {
            const payment = await prisma.payment.create({
              data: paymentData,
            });
            synced.push(payment.id);
          }
        } catch (error: any) {
          errors.push({
            paymentId: qbPayment.Id || 'N/A',
            error: error.message,
          });
        }
      }

      return {
        total: qbPayments.length,
        synced: synced.length,
        errors: errors.length,
      };
    } catch (error: any) {
      console.error("[QuickBooks Sync] Error syncing payments:", error);
      throw error;
    }
  }

  /**
   * Sync payments from Hub to QB (Hub → QB)
   * Syncs paid invoices that have been recorded in the Hub but not yet in QB
   */
  async syncPaymentsToQuickBooks(): Promise<{
    total: number;
    synced: number;
    errors: number;
  }> {
    try {
      console.log('[QuickBooks Sync] Starting payment sync (Hub → QB)');

      // Find all paid invoices that have QB invoice ID but payment not yet synced
      const paidInvoices = await prisma.invoice.findMany({
        where: {
          status: 'PAID',
          quickbooks_invoice_id: { not: null },
          paidAt: { not: null },
          amountPaid: { not: null },
        },
        include: {
          customer: true,
          payments: {
            where: { quickbooks_payment_id: { not: null } },
          },
        },
      });

      console.log(`[QuickBooks Sync] Found ${paidInvoices.length} paid invoices to sync`);

      let synced = 0;
      let errors = 0;

      for (const invoice of paidInvoices) {
        try {
          // Skip if payment already synced to QB
          if (invoice.payments.length > 0) {
            console.log(`[QB Sync] Invoice ${invoice.id} payment already synced`);
            continue;
          }

          if (!invoice.customer.quickbooks_id) {
            console.warn(`[QB Sync] Customer ${invoice.customerId} has no QB ID`);
            errors++;
            continue;
          }

          // Create payment in QuickBooks
          const qbPayment = await quickbooksService.createPayment({
            customerId: invoice.customer.quickbooks_id,
            invoiceId: invoice.quickbooks_invoice_id!,
            amount: Number(invoice.amountPaid),
            paymentDate: invoice.paidAt!,
            paymentMethod: invoice.paymentMethod || 'QuickBooks',
          });

          // Record the payment sync in our database
          await prisma.payment.create({
            data: {
              amount: invoice.amountPaid!,
              currency: 'USD',
              paymentDate: invoice.paidAt!,
              paymentMethod: invoice.paymentMethod || 'QuickBooks',
              referenceNumber: qbPayment.Id,
              quickbooks_payment_id: qbPayment.Id,
              invoiceId: invoice.id,
              customerId: invoice.customerId,
              syncedFromQb: false,
              syncedToQb: true,
              lastSyncAt: new Date(),
              metadata: {
                hubInvoiceId: invoice.id,
                syncedVia: 'Hub→QB',
              } as any,
            },
          });

          synced++;
          console.log(`[QB Sync] Payment created in QB for invoice ${invoice.id}`);
        } catch (error: any) {
          console.error(`[QB Sync] Error syncing payment for invoice ${invoice.id}:`, error);
          errors++;

          // Log the error
          await prisma.integrationLog.create({
            data: {
              service: 'QUICKBOOKS',
              action: 'PAYMENT_SYNC_HUB_TO_QB',
              status: 'ERROR',
              error: error.message,
              payload: {
                invoiceId: invoice.id,
                customerId: invoice.customerId,
              } as any,
            },
          });
        }
      }

      console.log(
        `[QuickBooks Sync] Payment sync complete: ${synced} synced, ${errors} errors`
      );

      return {
        total: paidInvoices.length,
        synced,
        errors,
      };
    } catch (error: any) {
      console.error('[QuickBooks Sync] Error in syncPaymentsToQuickBooks:', error);
      throw error;
    }
  }

  /**
   * Sync Items from QuickBooks to Hub database
   * Stores items locally for faster invoice creation UI
   */
  private async syncItems(maxResults: number): Promise<SyncResult["items"]> {
    try {
      const qbItems = await quickbooksService.getAllItems(maxResults);

      console.log(`[QuickBooks Sync] Syncing ${qbItems.length} items from QB`);

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ itemId: string; error: string }> = [];

      for (const qbItem of qbItems) {
        try {
          const qbItemId = qbItem.Id;

          const itemData = {
            qbId: qbItemId,
            name: qbItem.Name,
            description: qbItem.Description,
            unitPrice: qbItem.UnitPrice ? parseFloat(qbItem.UnitPrice) : undefined,
            type: qbItem.Type, // Service, NonInventory, Inventory, etc.
            active: qbItem.Active !== false,
            metadata: {
              quickbooksData: {
                syncDate: new Date().toISOString(),
                accountRef: qbItem.AccountRef,
                incomeAccountRef: qbItem.IncomeAccountRef,
              },
            } as any,
          };

          const existing = await prisma.quickBooksItem.findUnique({
            where: { qbId: qbItemId },
          });

          if (existing) {
            await prisma.quickBooksItem.update({
              where: { qbId: qbItemId },
              data: itemData,
            });
            updated.push(existing.id);
          } else {
            const item = await prisma.quickBooksItem.create({
              data: itemData,
            });
            synced.push(item.id);
          }
        } catch (error: any) {
          errors.push({
            itemId: qbItem.Id || 'N/A',
            error: error.message,
          });
        }
      }

      console.log(`[QuickBooks Sync] Items synced: ${synced.length}, updated: ${updated.length}, errors: ${errors.length}`);

      return {
        total: qbItems.length,
        synced: synced.length,
        errors: errors.length,
      };
    } catch (error: any) {
      console.error("[QuickBooks Sync] Error syncing items:", error);
      throw error;
    }
  }

  /**
   * Sincronizar Price Levels do QuickBooks
   */
  private async syncPriceLevels(maxResults: number): Promise<SyncResult["priceLevels"]> {
    try {
      const qbPriceLevels = await quickbooksService.getPriceLevels(maxResults);

      console.log(`[QuickBooks Sync] Syncing ${qbPriceLevels.length} price levels from QB`);

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ priceLevelId: string; error: string }> = [];

      for (const qbPriceLevel of qbPriceLevels) {
        try {
          const qbId = qbPriceLevel.Id;

          const priceLevelData = {
            qbId,
            name: qbPriceLevel.Name,
            active: qbPriceLevel.Active !== false,
            metadata: {
              quickbooksData: {
                syncDate: new Date().toISOString(),
                fullData: qbPriceLevel,
              },
            } as any,
          };

          const existing = await prisma.quickBooksPriceLevel.findUnique({
            where: { qbId },
          });

          if (existing) {
            await prisma.quickBooksPriceLevel.update({
              where: { qbId },
              data: priceLevelData,
            });
            updated.push(existing.id);
          } else {
            const priceLevel = await prisma.quickBooksPriceLevel.create({
              data: priceLevelData,
            });
            synced.push(priceLevel.id);
          }
        } catch (error: any) {
          errors.push({
            priceLevelId: qbPriceLevel.Id || 'N/A',
            error: error.message,
          });
        }
      }

      console.log(`[QuickBooks Sync] Price levels synced: ${synced.length}, updated: ${updated.length}, errors: ${errors.length}`);

      return {
        total: qbPriceLevels.length,
        synced: synced.length,
        errors: errors.length,
      };
    } catch (error: any) {
      console.error("[QuickBooks Sync] Error syncing price levels:", error);
      throw error;
    }
  }

  /**
   * Sincronizar Payment Terms do QuickBooks
   */
  private async syncPaymentTerms(maxResults: number): Promise<SyncResult["paymentTerms"]> {
    try {
      const qbPaymentTerms = await quickbooksService.getPaymentTerms(maxResults);

      console.log(`[QuickBooks Sync] Syncing ${qbPaymentTerms.length} payment terms from QB`);

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ termId: string; error: string }> = [];

      for (const qbTerm of qbPaymentTerms) {
        try {
          const qbId = qbTerm.Id;

          const paymentTermData = {
            qbId,
            name: qbTerm.Name,
            dueDays: qbTerm.DueDays || null,
            discountDays: qbTerm.DiscountDays || null,
            discountPercent: qbTerm.DiscountPercent ? parseFloat(qbTerm.DiscountPercent) : null,
            active: qbTerm.Active !== false,
            metadata: {
              quickbooksData: {
                syncDate: new Date().toISOString(),
                fullData: qbTerm,
              },
            } as any,
          };

          const existing = await prisma.quickBooksPaymentTerm.findUnique({
            where: { qbId },
          });

          if (existing) {
            await prisma.quickBooksPaymentTerm.update({
              where: { qbId },
              data: paymentTermData,
            });
            updated.push(existing.id);
          } else {
            const paymentTerm = await prisma.quickBooksPaymentTerm.create({
              data: paymentTermData,
            });
            synced.push(paymentTerm.id);
          }
        } catch (error: any) {
          errors.push({
            termId: qbTerm.Id || 'N/A',
            error: error.message,
          });
        }
      }

      console.log(`[QuickBooks Sync] Payment terms synced: ${synced.length}, updated: ${updated.length}, errors: ${errors.length}`);

      return {
        total: qbPaymentTerms.length,
        synced: synced.length,
        errors: errors.length,
      };
    } catch (error: any) {
      console.error("[QuickBooks Sync] Error syncing payment terms:", error);
      throw error;
    }
  }

  /**
   * Incremental sync using QuickBooks Change Data Capture (CDC) API.
   * Only fetches entities changed since the last successful sync.
   * Handles deletions by voiding local records.
   * Uses bulk pre-fetching to minimize DB round-trips for remote DBs.
   */
  async syncIncremental(): Promise<SyncResult> {
    const startTime = new Date();
    const result: SyncResult = { success: false, startTime };

    try {
      await quickbooksService.initialize();

      const lastSyncRow = await prisma.integrationLog.findFirst({
        where: { service: "QUICKBOOKS", action: "SYNC", status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      });

      const sinceDate = lastSyncRow?.createdAt
        ? lastSyncRow.createdAt
        : new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

      // Cap at 3 days for cron reliability — catches up over multiple runs
      const maxPast = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const changedSince = sinceDate < maxPast ? maxPast : sinceDate;

      const sinceIso = changedSince.toISOString();
      console.log(`[QB CDC Sync] Fetching changes since ${sinceIso}`);

      const cdcData = await (quickbooksService as any).request(
        `/cdc?entities=Customer,Invoice,Payment&changedSince=${sinceIso}`
      );

      const responses = cdcData?.CDCResponse || [];
      let changedCustomers: any[] = [];
      let changedInvoices: any[] = [];
      let deletedInvoices: any[] = [];
      let changedPayments: any[] = [];

      for (const resp of responses) {
        for (const qr of resp.QueryResponse || []) {
          if (qr.Customer) {
            const all = Array.isArray(qr.Customer) ? qr.Customer : [qr.Customer];
            changedCustomers = all.filter((e: any) => e.status !== "Deleted");
          }
          if (qr.Invoice) {
            const all = Array.isArray(qr.Invoice) ? qr.Invoice : [qr.Invoice];
            changedInvoices = all.filter((e: any) => e.status !== "Deleted");
            deletedInvoices = all.filter((e: any) => e.status === "Deleted");
          }
          if (qr.Payment) {
            const all = Array.isArray(qr.Payment) ? qr.Payment : [qr.Payment];
            changedPayments = all.filter((e: any) => e.status !== "Deleted");
          }
        }
      }

      console.log(`[QB CDC Sync] Changes: ${changedCustomers.length} customers, ${changedInvoices.length} invoices, ${changedPayments.length} payments`);
      console.log(`[QB CDC Sync] Deletions: ${deletedInvoices.length} invoices`);

      // --- Bulk pre-fetch to minimize DB round-trips ---
      const qbCustomerIds = [
        ...new Set([
          ...changedCustomers.map((c: any) => c.Id),
          ...changedInvoices.map((i: any) => i.CustomerRef?.value).filter(Boolean),
        ]),
      ];
      const qbInvoiceIds = [
        ...changedInvoices.map((i: any) => i.Id),
        ...deletedInvoices.map((d: any) => d.Id),
      ];
      const qbPaymentIds = changedPayments.map((p: any) => p.Id);

      const [existingCustomers, existingInvoices, existingPayments] = await Promise.all([
        qbCustomerIds.length > 0
          ? prisma.customer.findMany({
              where: { quickbooks_id: { in: qbCustomerIds } },
              select: { id: true, quickbooks_id: true, qbBalance: true },
            })
          : [],
        qbInvoiceIds.length > 0
          ? prisma.invoice.findMany({
              where: { quickbooks_invoice_id: { in: qbInvoiceIds } },
              select: { id: true, quickbooks_invoice_id: true, customerId: true, status: true, installments: true },
            })
          : [],
        qbPaymentIds.length > 0
          ? prisma.payment.findMany({
              where: { quickbooks_payment_id: { in: qbPaymentIds } },
              select: { id: true, quickbooks_payment_id: true },
            })
          : [],
      ]);

      const customerByQbId = new Map(existingCustomers.map((c) => [c.quickbooks_id, c]));
      const invoiceByQbId = new Map(existingInvoices.map((i) => [i.quickbooks_invoice_id, i]));
      const paymentByQbId = new Map(existingPayments.map((p) => [p.quickbooks_payment_id, p]));

      console.log(`[QB CDC Sync] Pre-fetched: ${customerByQbId.size} customers, ${invoiceByQbId.size} invoices, ${paymentByQbId.size} payments from DB`);

      // --- Process changed customers (balance updates only — fast) ---
      const custResult = { total: changedCustomers.length, synced: 0, updated: 0, errors: 0 };
      for (const qbCustomer of changedCustomers) {
        try {
          const existing = customerByQbId.get(qbCustomer.Id);
          if (!existing) continue;
          await prisma.customer.update({
            where: { id: existing.id },
            data: {
              qbBalance: qbCustomer.Balance || 0,
              lastQbBalanceSync: new Date(),
              lastQuickbooksSyncAt: new Date(),
            },
          });
          custResult.updated++;
        } catch { custResult.errors++; }
      }
      result.customers = custResult;

      // --- Process changed invoices (skip no-op updates) ---
      const invResult = { total: changedInvoices.length, synced: 0, updated: 0, errors: 0 };
      let invSkipped = 0;
      for (const qbInvoice of changedInvoices) {
        try {
          const existing = invoiceByQbId.get(qbInvoice.Id);
          if (!existing) continue;

          const totalAmount = qbInvoice.TotalAmt || 0;
          const balance = qbInvoice.Balance ?? totalAmount;
          const qbStatus = balance === 0 ? "PAID" : balance === totalAmount ? "SENT" : "OVERDUE";
          const dueDate = parseQuickBooksDueDate(qbInvoice.DueDate);
          const excludeFromHub = shouldExcludeOpenQuickBooksInvoiceFromHub(dueDate, balance);

          if (excludeFromHub) {
            await prisma.invoice.update({
              where: { id: existing.id },
              data: {
                installments: mergeQuickBooksInvoiceMetadata(existing.installments, {
                  syncDate: new Date().toISOString(),
                  txnDate: qbInvoice.TxnDate,
                  balance,
                  totalAmt: totalAmount,
                  excludedFromHub: true,
                  excludedFromHubAt: new Date().toISOString(),
                  exclusionReason: "legacy_overdue_pre_2025",
                }) as any,
              },
            });
            invResult.updated++;
            continue;
          }

          // Skip if status hasn't changed — most CDC entries are metadata-only updates
          if (existing.status === qbStatus) { invSkipped++; continue; }

          const amountPaid = balance === 0 ? totalAmount : totalAmount - balance;
          const paidAt = amountPaid > 0 ? new Date(qbInvoice.TxnDate || new Date()) : null;

          await prisma.invoice.update({
            where: { id: existing.id },
            data: {
              status: qbStatus as any,
              amount: totalAmount,
              dueDate,
              amountPaid,
              paidAt,
              installments: {
                ...(existing.installments as any || {}),
                quickbooks: {
                  syncDate: new Date().toISOString(),
                  txnDate: qbInvoice.TxnDate,
                  balance,
                  totalAmt: totalAmount,
                  excludedFromHub: false,
                },
              } as any,
            },
          });
          if (qbStatus === "PAID") {
            await triggerOperationalOnboardingForPaidInvoice(existing.id, "cdcSync");
          }
          invResult.updated++;
        } catch { invResult.errors++; }
      }
      if (invSkipped > 0) console.log(`[QB CDC Sync] Skipped ${invSkipped} invoices (status unchanged)`);
      result.invoices = invResult;

      // --- Void deleted invoices ---
      let voidedCount = 0;
      for (const deleted of deletedInvoices) {
        try {
          const existing = invoiceByQbId.get(deleted.Id);
          if (existing && existing.status !== "VOID") {
            await prisma.invoice.update({
              where: { id: existing.id },
              data: { status: "VOID" },
            });
            voidedCount++;
          }
        } catch {}
      }
      if (voidedCount > 0) {
        console.log(`[QB CDC Sync] Voided ${voidedCount} invoices deleted in QB`);
      }

      // --- Process changed payments ---
      const payResult = { total: changedPayments.length, synced: 0, errors: 0 };
      for (const qbPayment of changedPayments) {
        try {
          const invoiceRef = findLinkedQuickBooksInvoiceId(qbPayment);
          if (!invoiceRef) continue;

          const invoice = invoiceByQbId.get(invoiceRef);
          if (!invoice) continue;

          const existingPayment = paymentByQbId.get(qbPayment.Id);
          const linkedInvoiceQbCustomerId = changedInvoices.find((i: any) => i.Id === invoiceRef)?.CustomerRef?.value;
          const customerId = resolveLocalCustomerIdForPayment({
            linkedInvoiceCustomerId: invoice.customerId,
            linkedInvoiceQbCustomerId,
            customerByQbId,
          });
          if (!customerId) continue;

          const paymentData = {
            amount: qbPayment.TotalAmt || 0,
            currency: "USD",
            paymentDate: qbPayment.TxnDate ? new Date(qbPayment.TxnDate) : new Date(),
            paymentMethod: "QuickBooks",
            referenceNumber: qbPayment.DocNumber,
            quickbooks_payment_id: qbPayment.Id,
            invoiceId: invoice.id,
            customerId,
            syncedFromQb: true,
            metadata: { quickbooksPaymentData: qbPayment } as any,
          };

          if (existingPayment) {
            await prisma.payment.update({ where: { id: existingPayment.id }, data: paymentData });
          } else {
            await prisma.payment.create({ data: paymentData });
          }
          payResult.synced++;
        } catch { payResult.errors++; }
      }
      result.payments = payResult;

      const endTime = new Date();
      result.endTime = endTime;
      result.duration = endTime.getTime() - startTime.getTime();
      result.success = true;

      await this.logSync(result);
      console.log(`[QB CDC Sync] Completed in ${result.duration}ms`);
      return result;
    } catch (error: any) {
      const endTime = new Date();
      result.endTime = endTime;
      result.duration = endTime.getTime() - startTime.getTime();
      result.error = error.message || "Unknown error";
      await this.logSync(result, error);
      throw error;
    }
  }

  /**
   * Log da sincronização no IntegrationLog
   */
  private async logSync(result: SyncResult, error?: any): Promise<void> {
    try {
      await prisma.$transaction(async (tx) => {
        await tx.integrationLog.create({
          data: {
            service: "QUICKBOOKS",
            action: "SYNC",
            status: result.success ? "SUCCESS" : "ERROR",
            error: error?.message || result.error || undefined,
            payload: {
              syncResult: {
                customers: result.customers,
                invoices: result.invoices,
                payments: result.payments,
                items: result.items,
                priceLevels: result.priceLevels,
                paymentTerms: result.paymentTerms,
                duration: result.duration,
                startTime: result.startTime.toISOString(),
                endTime: result.endTime?.toISOString(),
              },
            } as any,
          },
        });

        if (result.success) {
          await tx.systemConfig.upsert({
            where: { id: "system" },
            update: { last_qb_sync: result.endTime ?? new Date() },
            create: { id: "system", last_qb_sync: result.endTime ?? new Date() },
          });
        }
      });
    } catch (logError) {
      console.error("[QuickBooks Sync] Error logging sync:", logError);
    }
  }

  /**
   * Bulk import all QuickBooks Customers
   */
  async importAllCustomers(importId: string): Promise<void> {
    let startPosition = 1;
    let hasMore = true;
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    try {
      // Initialize QuickBooks service to load tokens from database
      await quickbooksService.initialize();

      await prisma.bulkImport.update({
        where: { id: importId },
        data: { status: "RUNNING" },
      });

      while (hasMore) {
        // Fetch customers from QuickBooks (1000 at a time)
        const result = await quickbooksService.getAllCustomersPaginated({ startPosition });

        const customers = result.customers || [];
        hasMore = result.hasMore;
        startPosition = result.nextPosition;

        // Update total records count on first batch
        if (totalProcessed === 0 && customers.length > 0) {
          const totalEstimate = hasMore ? customers.length * 10 : customers.length; // Rough estimate
          await prisma.bulkImport.update({
            where: { id: importId },
            data: { totalRecords: totalEstimate },
          });
        }

        // Process each customer
        for (const qbCustomer of customers) {
          try {
            const email = qbCustomer.PrimaryEmailAddr?.Address;
            const name = qbCustomer.DisplayName || qbCustomer.CompanyName || "Unknown";
            const phone = qbCustomer.PrimaryPhone?.FreeFormNumber;

            if (!email) {
              errors.push({ customerId: qbCustomer.Id, error: "No email found" });
              errorCount++;
              continue;
            }

            // Reconcile customer via Identity Mapper
            await identityMapper.reconcileCustomer({
              email,
              name,
              phone,
              externalIds: {
                quickbooks_id: qbCustomer.Id,
              },
              metadata: {
                quickbooks: {
                  syncDate: new Date().toISOString(),
                  customerData: qbCustomer,
                },
              },
            });

            successCount++;
          } catch (error) {
            console.error(`[BULK_IMPORT] Error importing customer ${qbCustomer.Id}:`, error);
            errors.push({
              customerId: qbCustomer.Id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            errorCount++;
          }

          totalProcessed++;

          // Update progress every 100 records
          if (totalProcessed % 100 === 0) {
            await prisma.bulkImport.update({
              where: { id: importId },
              data: {
                processedRecords: totalProcessed,
                successCount,
                errorCount,
              },
            });
          }
        }
      }

      // Mark as completed
      await prisma.bulkImport.update({
        where: { id: importId },
        data: {
          status: "COMPLETED",
          processedRecords: totalProcessed,
          successCount,
          errorCount,
          errors: errors.length > 0 ? (errors as any) : null,
          completedAt: new Date(),
        },
      });

      console.log(`[BULK_IMPORT] Completed QuickBooks customers import: ${successCount} success, ${errorCount} errors`);
    } catch (error) {
      console.error("[BULK_IMPORT] Fatal error during QuickBooks customers import:", error);

      // Mark as failed
      await prisma.bulkImport.update({
        where: { id: importId },
        data: {
          status: "FAILED",
          processedRecords: totalProcessed,
          successCount,
          errorCount,
          errors: [...errors, { error: error instanceof Error ? error.message : "Unknown error" }] as any,
          completedAt: new Date(),
        },
      });

      throw error;
    }
  }

  /**
   * Bulk import all QuickBooks Invoices
   */
  async importAllInvoices(importId: string): Promise<void> {
    let startPosition = 1;
    let hasMore = true;
    let totalProcessed = 0;
    let successCount = 0;
    let errorCount = 0;
    const errors: any[] = [];

    try {
      // Initialize QuickBooks service to load tokens from database
      await quickbooksService.initialize();

      // Note: Import might already be RUNNING from importAllCustomers
      // Only update if status is still pending
      const currentImport = await prisma.bulkImport.findUnique({
        where: { id: importId },
      });

      if (currentImport?.status !== "RUNNING") {
        await prisma.bulkImport.update({
          where: { id: importId },
          data: { status: "RUNNING" },
        });
      }

      while (hasMore) {
        // Fetch invoices from QuickBooks (1000 at a time)
        const result = await quickbooksService.getAllInvoicesPaginated({ startPosition });

        const invoices = result.invoices || [];
        hasMore = result.hasMore;
        startPosition = result.nextPosition;

        // Process each invoice
        for (const qbInvoice of invoices) {
          try {
            // Find corresponding customer by QuickBooks customer ID
            const customer = await prisma.customer.findFirst({
              where: { quickbooks_id: qbInvoice.CustomerRef?.value },
            });

            if (!customer) {
              errors.push({
                invoiceId: qbInvoice.Id,
                error: `Customer not found for QB ID ${qbInvoice.CustomerRef?.value}`,
              });
              errorCount++;
              continue;
            }

            // Get or create a default deal for this customer
            let deal = await prisma.deal.findFirst({
              where: {
                customerId: customer.id,
                title: "QuickBooks Import",
              },
            });

            if (!deal) {
              // Generate a unique negative ID for QB-only deals using customer's QB ID
              const qbDealId = -Math.abs(parseInt(customer.quickbooks_id || "0"));

              deal = await prisma.deal.create({
                data: {
                  customerId: customer.id,
                  title: "QuickBooks Import",
                  value: 0,
                  currency: "USD",
                  status: "OPEN",
                  clint_deal_id: String(qbDealId), // Unique negative ID for QB-only deals
                },
              });
            }

            // Map QuickBooks status to our status enum
            let status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "PARTIALLY_PAID" | "VOID" = "SENT";
            if (qbInvoice.Balance === 0) {
              status = "PAID";
            } else if (qbInvoice.EmailStatus === "EmailSent") {
              status = "SENT";
            }

            // Create or update invoice
            const totalAmount = qbInvoice.TotalAmt || 0;
            const balance = qbInvoice.Balance || 0;
            const amountPaidBulk = balance === 0 ? totalAmount : balance < totalAmount && balance > 0 ? totalAmount - balance : 0;
            const paidAtBulk = amountPaidBulk > 0 ? new Date(qbInvoice.TxnDate || new Date()) : null;

            await prisma.invoice.upsert({
              where: {
                quickbooks_invoice_id: qbInvoice.Id,
              },
              create: {
                customerId: customer.id,
                dealId: deal.id,
                invoiceNumber: qbInvoice.DocNumber || qbInvoice.Id,
                amount: totalAmount,
                dueDate: parseQuickBooksDueDate(qbInvoice.DueDate),
                status,
                quickbooks_invoice_id: qbInvoice.Id,
                ...(extractQuickbooksInvoiceLink(qbInvoice) ? { quickbooks_invoice_link: extractQuickbooksInvoiceLink(qbInvoice) } : {}),
                amountPaid: amountPaidBulk,
                paidAt: paidAtBulk,
              },
              update: {
                invoiceNumber: qbInvoice.DocNumber || qbInvoice.Id,
                amount: totalAmount,
                dueDate: parseQuickBooksDueDate(qbInvoice.DueDate),
                status,
                ...(extractQuickbooksInvoiceLink(qbInvoice) ? { quickbooks_invoice_link: extractQuickbooksInvoiceLink(qbInvoice) } : {}),
                amountPaid: amountPaidBulk,
                paidAt: paidAtBulk,
              },
            });

            successCount++;
          } catch (error) {
            console.error(`[BULK_IMPORT] Error importing invoice ${qbInvoice.Id}:`, error);
            errors.push({
              invoiceId: qbInvoice.Id,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            errorCount++;
          }

          totalProcessed++;

          // Update progress every 100 records
          if (totalProcessed % 100 === 0) {
            await prisma.bulkImport.update({
              where: { id: importId },
              data: {
                processedRecords: totalProcessed + successCount,
                successCount,
                errorCount,
              },
            });
          }
        }
      }

      // Update final counts (don't mark as completed yet, might have more types to import)
      await prisma.bulkImport.update({
        where: { id: importId },
        data: {
          processedRecords: totalProcessed,
          successCount,
          errorCount,
          errors: errors.length > 0 ? (errors as any) : null,
        },
      });

      console.log(`[BULK_IMPORT] Completed QuickBooks invoices import: ${successCount} success, ${errorCount} errors`);
    } catch (error) {
      console.error("[BULK_IMPORT] Fatal error during QuickBooks invoices import:", error);
      throw error;
    }
  }
}

export const quickbooksSyncService = new QuickBooksSyncService();
