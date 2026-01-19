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
      const dueDate = qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : new Date();
      const today = new Date();

      if (balance === 0) {
        status = "PAID";
      } else if (balance < totalAmt && balance > 0) {
        status = "PARTIALLY_PAID";
      } else if (dueDate < today && balance > 0) {
        status = "OVERDUE";
      } else if (qbInvoice.EmailStatus === "EmailSent") {
        status = "SENT";
      }

      // Check if invoice exists
      const existing = await prisma.invoice.findUnique({
        where: { quickbooks_invoice_id: qbInvoiceId },
      });

      // Get or create a default deal for this customer
      let deal = await prisma.deal.findFirst({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
      });

      if (!deal) {
        // Generate a unique negative ID for QB-only deals using customer's QB ID
        // This avoids conflicts while keeping pipedrive_deal_id unique
        const qbDealId = -Math.abs(parseInt(customerRef));

        deal = await prisma.deal.create({
          data: {
            customerId: customer.id,
            title: "QuickBooks Import",
            value: totalAmt,
            currency: "USD",
            status: "OPEN",
            pipedrive_deal_id: qbDealId, // Unique negative ID for QB-only deals
          },
        });
      }

      const invoiceData = {
        invoiceNumber: qbInvoice.DocNumber || qbInvoiceId,
        amount: totalAmt,
        dueDate,
        status,
        quickbooks_invoice_id: qbInvoiceId,
        dealId: existing?.dealId || deal.id,
        customerId: customer.id,
        approvalStatus: "APPROVED" as const, // QB invoices are pre-approved
        markedOverdueAt: status === "OVERDUE" ? new Date() : existing?.markedOverdueAt || null,
        amountPaid: balance === 0 ? totalAmt : balance < totalAmt && balance > 0 ? totalAmt - balance : 0,
        paidAt: balance < totalAmt && balance >= 0 ? (balance === 0 ? new Date(qbInvoice.TxnDate || new Date()) : new Date()) : null,
        installments: {
          quickbooks: {
            syncDate: new Date().toISOString(),
            txnDate: qbInvoice.TxnDate,
            balance,
            totalAmt,
            emailStatus: qbInvoice.EmailStatus,
          },
        } as any,
      };

      let invoice;
      if (existing) {
        invoice = await prisma.invoice.update({
          where: { id: existing.id },
          data: invoiceData,
        });
      } else {
        invoice = await prisma.invoice.create({
          data: invoiceData,
        });
      }

      console.log(`[QuickBooks Sync] Invoice ${qbInvoiceId} synced: ${invoice.id} (${existing ? 'updated' : 'new'}) - Status: ${status}`);

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

      let payment;
      if (existingPayment) {
        payment = await prisma.payment.update({
          where: { id: existingPayment.id },
          data: paymentData,
        });
      } else {
        payment = await prisma.payment.create({
          data: paymentData,
        });
      }

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

      while (hasMore && allCustomers.length < maxResults) {
        const result = await quickbooksService.getAllCustomersPaginated({ startPosition });
        allCustomers = allCustomers.concat(result.customers);
        hasMore = result.hasMore;
        startPosition = result.nextPosition;
        pageCount++;

        console.log(`[QuickBooks Sync] Page ${pageCount}: fetched ${result.customers.length} customers, total: ${allCustomers.length}, hasMore: ${hasMore}`);

        // Stop if we've reached maxResults
        if (allCustomers.length >= maxResults) {
          allCustomers = allCustomers.slice(0, maxResults);
          break;
        }
      }

      console.log(`[QuickBooks Sync] Completed fetching customers: ${allCustomers.length} total across ${pageCount} pages`);

      const qbCustomers = allCustomers;

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ email: string; error: string }> = [];

      for (const qbCustomer of qbCustomers) {
        try {
          const email = qbCustomer.PrimaryEmailAddr?.Address;
          const name = qbCustomer.DisplayName || qbCustomer.CompanyName || "Unknown";
          const phone = qbCustomer.PrimaryPhone?.FreeFormNumber;

          if (!email) {
            errors.push({ email: "N/A", error: "Customer sem email" });
            continue;
          }

          // Se incremental, verificar se já existe e se precisa atualizar
          if (incremental) {
            const existing = await prisma.customer.findFirst({
              where: {
                OR: [
                  { email },
                  { quickbooks_id: qbCustomer.Id },
                ],
              },
            });

            // Verificar se precisa atualizar (comparar última modificação)
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
                  // Já sincronizado, pular
                  continue;
                }
              }
            }
          }

          const existing = await prisma.customer.findUnique({
            where: { email },
          });

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

          if (existing) {
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
      }

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

      while (hasMore && allInvoices.length < maxResults) {
        const result = await quickbooksService.getAllInvoicesPaginated({ startPosition });
        allInvoices = allInvoices.concat(result.invoices);
        hasMore = result.hasMore;
        startPosition = result.nextPosition;
        pageCount++;

        console.log(`[QuickBooks Sync] Page ${pageCount}: fetched ${result.invoices.length} invoices, total: ${allInvoices.length}, hasMore: ${hasMore}`);

        // Stop if we've reached maxResults
        if (allInvoices.length >= maxResults) {
          allInvoices = allInvoices.slice(0, maxResults);
          break;
        }
      }

      console.log(`[QuickBooks Sync] Completed fetching invoices: ${allInvoices.length} total across ${pageCount} pages`);

      const qbInvoices = allInvoices;

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ invoiceId: string; error: string }> = [];

      for (const qbInvoice of qbInvoices) {
        try {
          const qbInvoiceId = qbInvoice.Id;
          const customerRef = qbInvoice.CustomerRef?.value;

          if (!customerRef) {
            errors.push({
              invoiceId: qbInvoiceId,
              error: "Invoice sem customer",
            });
            continue;
          }

          // Se incremental, verificar se precisa atualizar
          // Nota: Invoice não tem campo metadata, então sempre sincronizamos
          // Para melhorar performance, podemos usar updatedAt no futuro

          const customer = await prisma.customer.findFirst({
            where: { quickbooks_id: customerRef },
          });

          if (!customer) {
            errors.push({
              invoiceId: qbInvoiceId,
              error: `Customer ${customerRef} não encontrado`,
            });
            continue;
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
                pipedrive_deal_id: qbDealId, // Unique negative ID for QB-only deals
              },
            });
            console.log(`[QuickBooks Sync] Created default deal for customer ${customer.id}: ${latestDeal.id}`);
          }

            // Nota: Invoice não tem campo metadata, então salvamos dados extras no installments (Json)
            // ou simplesmente não salvamos. Para rastreabilidade, podemos usar IntegrationLog
            const balance = qbInvoice.Balance || 0;
            const amountPaid = balance === 0 ? totalAmount : balance < totalAmount && balance > 0 ? totalAmount - balance : 0;
            const paidAt = amountPaid > 0 ? new Date(qbInvoice.TxnDate || new Date()) : null;

            const invoiceData = {
              invoiceNumber: qbInvoice.DocNumber || undefined,
              amount: totalAmount,
              dueDate: qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : new Date(),
              status: qbStatus as any,
              quickbooks_invoice_id: qbInvoiceId,
              dealId: latestDeal.id,
              customerId: customer.id,
              amountPaid,
              paidAt,
              // installments pode ser usado para dados extras se necessário
              installments: {
                quickbooks: {
                  syncDate: new Date().toISOString(),
                  txnDate: qbInvoice.TxnDate,
                  balance: qbInvoice.Balance,
                  totalAmt: qbInvoice.TotalAmt,
                },
              } as any,
            };

          if (existing) {
            await prisma.invoice.update({
              where: { id: existing.id },
              data: invoiceData,
            });
            updated.push(existing.id);
          } else {
            const invoice = await prisma.invoice.create({
              data: invoiceData,
            });
            synced.push(invoice.id);
          }
        } catch (error: any) {
          errors.push({
            invoiceId: qbInvoice.Id || "N/A",
            error: error.message,
          });
        }
      }

      return {
        total: qbInvoices.length,
        synced: synced.length,
        updated: updated.length,
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
      // Fetch all payments from QuickBooks
      const qbPayments = await quickbooksService.getAllPayments(maxResults);

      const synced: string[] = [];
      const updated: string[] = [];
      const errors: Array<{ paymentId: string; error: string }> = [];

      for (const qbPayment of qbPayments) {
        try {
          const qbPaymentId = qbPayment.Id;
          const invoiceRef = qbPayment.Line?.[0]?.LinkedTxns?.[0]?.txnId;

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
            paymentMethod: invoice.paymentMethod || 'Stripe',
          });

          // Record the payment sync in our database
          await prisma.payment.create({
            data: {
              amount: invoice.amountPaid!,
              currency: 'USD',
              paymentDate: invoice.paidAt!,
              paymentMethod: invoice.paymentMethod || 'Stripe',
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
   * Log da sincronização no IntegrationLog
   */
  private async logSync(result: SyncResult, error?: any): Promise<void> {
    try {
      await prisma.integrationLog.create({
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
                  pipedrive_deal_id: qbDealId, // Unique negative ID for QB-only deals
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
                dueDate: qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : new Date(),
                status,
                quickbooks_invoice_id: qbInvoice.Id,
                approvalStatus: "APPROVED", // QB invoices are pre-approved
                amountPaid: amountPaidBulk,
                paidAt: paidAtBulk,
              },
              update: {
                invoiceNumber: qbInvoice.DocNumber || qbInvoice.Id,
                amount: totalAmount,
                dueDate: qbInvoice.DueDate ? new Date(qbInvoice.DueDate) : new Date(),
                status,
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

