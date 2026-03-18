import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";
import { contractWorkflowService } from "@/lib/services/contract-workflow.service";
import { invoiceWorkflowService } from "@/lib/services/invoice-workflow.service";
import { addMonths, parseLocalDate } from "@/lib/utils/date";

/** Create a Date at UTC noon for today - safe for date-only operations */
function todayUTCNoon(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0, 0));
}

export const dynamic = "force-dynamic";

const createInvoiceSchema = z.object({
  customerId: z.string(),
  dealId: z.string().optional(),
  items: z
    .array(
      z.object({
        serviceItemId: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        description: z.string().optional(),
      })
    )
    .min(1),
  discount: z.number().min(0).optional(),
  entryAmount: z.number().min(0).optional(),
  installments: z.number().min(0).max(12).optional(),
  dueDate: z.string().optional(), // Aceita string de data simples (YYYY-MM-DD)
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  const userId = (session.user as any).id;
  const allowedRoles = ["ADMIN", "FINANCE", "SALES", "COMMERCIAL"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createInvoiceSchema.parse(body);

    const { customerId, dealId } = data;

    // Garantir que customer existe
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Validar deal se fornecido
    if (dealId) {
      const deal = await prisma.deal.findUnique({ where: { id: dealId } });
      if (!deal) {
        return NextResponse.json({ error: "Deal not found" }, { status: 404 });
      }
    }

    // Calculate total amount
    const baseAmount = data.items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const discount = data.discount || 0;
    const totalAmount = Math.max(0, baseAmount - discount);

    const entryAmount = data.entryAmount || 0;
    const installmentCount = data.installments || 0;
    const remaining = Math.max(0, totalAmount - entryAmount);
    const isSinglePayment = entryAmount === 0 && installmentCount === 0;

    // Generate series ID for linking installments
    const seriesId = `SERIES-${Date.now()}`;
    const invoices: any[] = [];

    // Determine number of invoices to create
    // IMPORTANT: When there's an entry + installments, create SEPARATE invoices
    // Entry today + installments start NEXT MONTH
    let invoiceCountToCreate = 1;
    if (entryAmount > 0 && installmentCount > 0) {
      // Entry + installments = 1 + N invoices (entry separate, installments start next month)
      invoiceCountToCreate = 1 + installmentCount;
    } else if (entryAmount > 0) {
      // Entry only = 1 invoice
      invoiceCountToCreate = 1;
    } else if (installmentCount > 0) {
      // Just installments = N invoices
      invoiceCountToCreate = installmentCount;
    }

    // ============================================
    // PHASE 1: PRE-GENERATE ALL INVOICE METADATA
    // ============================================
    // Generate metadata for all invoices upfront to prevent duplicate DocNumbers
    interface InvoiceMetadata {
      number: string;
      dueDate: Date;
      amount: number;
      description: string;
      lineItems: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
        serviceItemId: string;
      }>;
    }

    const invoiceMetadata: InvoiceMetadata[] = [];

    for (let i = 1; i <= invoiceCountToCreate; i++) {
      let invoiceAmount: number;
      let invoiceDescription: string;
      let invoiceDueDate: Date;

      // Calculate amount and description based on position
      if (entryAmount > 0 && i === 1) {
        // ENTRY INVOICE: Separate entry payment due TODAY
        invoiceAmount = entryAmount;
        invoiceDescription = `${data.description || 'Service'} - Entry Payment`;
        invoiceDueDate = data.dueDate ? parseLocalDate(data.dueDate) : todayUTCNoon();
      } else if (entryAmount > 0 && i > 1) {
        // INSTALLMENT INVOICE (when entry exists): i=2 → Installment 1, i=3 → Installment 2
        const installmentAmount = remaining / installmentCount;
        const installmentNumber = i - 1; // i=2 is "Installment 1"
        invoiceAmount = Number(installmentAmount.toFixed(2));
        invoiceDescription = `${data.description || 'Service'} - Installment ${installmentNumber} of ${installmentCount}`;

        // Calculate due date: i=2 → +1 month, i=3 → +2 months
        const baseDueDate = data.dueDate ? parseLocalDate(data.dueDate) : todayUTCNoon();
        const monthsToAdd = i - 1; // i=2 → +1 month
        invoiceDueDate = addMonths(baseDueDate, monthsToAdd);
      } else if (installmentCount > 0) {
        // INSTALLMENT INVOICE (no entry): i=1 → Installment 1, i=2 → Installment 2
        const installmentAmount = totalAmount / installmentCount;
        invoiceAmount = Number(installmentAmount.toFixed(2));
        invoiceDescription = `${data.description || 'Service'} - Installment ${i} of ${installmentCount}`;

        // Calculate due date: i=1 → +0 months, i=2 → +1 month
        const baseDueDate = data.dueDate ? parseLocalDate(data.dueDate) : todayUTCNoon();
        const monthsToAdd = i - 1;
        invoiceDueDate = addMonths(baseDueDate, monthsToAdd);
      } else {
        // Single invoice (no installments, no entry split)
        invoiceAmount = totalAmount;
        invoiceDescription = data.description || 'Service';
        invoiceDueDate = data.dueDate ? parseLocalDate(data.dueDate) : todayUTCNoon();
      }

      // Prepare line items for this invoice
      let lineItems: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        amount: number;
        serviceItemId: string;
      }>;

      if (invoiceCountToCreate === 1) {
        // Single invoice - use original items
        lineItems = data.items.map((item) => ({
          description: item.description || invoiceDescription,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: Number((item.unitPrice * item.quantity).toFixed(2)),
          serviceItemId: item.serviceItemId,
        }));
      } else if (entryAmount > 0 && i === 1) {
        // Entry invoice - single line item for entry
        lineItems = [
          {
            description: `${data.description || 'Service'} - Entry Payment`,
            quantity: 1,
            unitPrice: entryAmount,
            amount: entryAmount,
            serviceItemId: data.items[0].serviceItemId,
          },
        ];
      } else if (entryAmount > 0 && i > 1) {
        // Installment invoice (when entry exists) - single line item
        const installmentNum = i - 1; // i=2 → Installment 1
        const installmentAmount = remaining / installmentCount;
        lineItems = [
          {
            description: `${data.description || 'Service'} - Installment ${installmentNum} of ${installmentCount}`,
            quantity: 1,
            unitPrice: Number(installmentAmount.toFixed(2)),
            amount: Number(installmentAmount.toFixed(2)),
            serviceItemId: data.items[0].serviceItemId,
          },
        ];
      } else {
        // Installment invoice (no entry) - single line item
        const installmentAmount = totalAmount / installmentCount;
        lineItems = [
          {
            description: `${data.description || 'Service'} - Installment ${i} of ${installmentCount}`,
            quantity: 1,
            unitPrice: Number(installmentAmount.toFixed(2)),
            amount: Number(installmentAmount.toFixed(2)),
            serviceItemId: data.items[0].serviceItemId,
          },
        ];
      }

      // Determine installment type for invoice number generation
      let installmentType: 'single' | 'entry' | 'installment';
      let installmentNum: number | undefined;

      if (invoiceCountToCreate === 1) {
        // Single invoice (no installments)
        installmentType = 'single';
      } else if (entryAmount > 0 && i === 1) {
        // Entry invoice (separate from installments)
        installmentType = 'entry';
      } else {
        // Regular installment payment
        installmentType = 'installment';
        // If entry exists: i=2 → Installment 1, i=3 → Installment 2
        // If no entry: i=1 → Installment 1, i=2 → Installment 2
        installmentNum = entryAmount > 0 ? i - 1 : i;
      }

      // Generate unique invoice number using enhanced format
      // Format: {CUSTOMER}-{SERVICE}-{YYYYMMDD}-{INSTALLMENT}-{HASH}
      // This guarantees uniqueness through multiple data points
      const invoiceNumber = generateInvoiceNumber({
        customerName: customer.name,
        serviceName: invoiceDescription,
        date: new Date(), // Use current date for creation timestamp
        installmentType: installmentType,
        installmentNumber: installmentNum,
        amount: invoiceAmount,
        seriesId: seriesId, // Use series ID for extra uniqueness
      });

      // Store metadata for this invoice
      invoiceMetadata.push({
        number: invoiceNumber,
        dueDate: invoiceDueDate,
        amount: invoiceAmount,
        description: invoiceDescription,
        lineItems: lineItems,
      });

      console.log(`[INVOICE_CREATE] Generated invoice ${i}/${invoiceCountToCreate}:`, {
        number: invoiceNumber,
        dueDate: invoiceDueDate.toISOString().split('T')[0],
        installmentType,
        installmentNumber: installmentNum,
        amount: invoiceAmount,
      });
    }

    console.log(`[INVOICE_CREATE] Pre-generated ${invoiceMetadata.length} invoice numbers:`, 
      invoiceMetadata.map(m => m.number));

    // ============================================
    // PHASE 2: CREATE INVOICES USING PRE-GENERATED METADATA
    // ============================================
    // Create multiple invoices (one per installment)
    for (let i = 1; i <= invoiceCountToCreate; i++) {
      // Use pre-generated metadata
      const metadata = invoiceMetadata[i - 1];
      const invoiceNumber = metadata.number;
      const invoiceDueDate = metadata.dueDate;
      const invoiceAmount = metadata.amount;
      const invoiceDescription = metadata.description;
      const lineItems = metadata.lineItems;

      let qbInvoiceId: string | undefined;
      
      // Email tracking variables (will be set during invoice creation)
      let emailSentAt: Date | undefined;
      let emailSendAttempts = 0;
      let lastEmailSendError: string | undefined;

      // Auto-approve and sync to QuickBooks immediately for all roles
      await quickbooksService.initialize();

      // Create customer in QuickBooks if necessary
      const qbCustomer = await quickbooksService.getOrCreateCustomer({
        email: customer.email,
        name: customer.name,
        phone: customer.phone || undefined,
      });

      // Ensure QB customer has correct email before sending invoice
      if (customer.email) {
        const emailVerified = await quickbooksService.ensureCustomerEmail(qbCustomer.Id, customer.email);

        // Log email verification result
        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: emailVerified ? "customer_email_verified" : "customer_email_verification_failed",
            status: emailVerified ? "SUCCESS" : "ERROR",
            payload: {
              qbCustomerId: qbCustomer.Id,
              customerEmail: customer.email,
              emailVerified,
            } as any,
          },
        });
      }

      // Prepare QB invoice data with BillEmail - QB requires email on invoice for sending
      const qbInvoiceData: any = {
        customerId: qbCustomer.Id,
        customerEmail: customer.email, // REQUIRED - set email on invoice itself
        dueDate: invoiceDueDate,
        docNumber: invoiceNumber, // Custom professional invoice number
        lineItems: (() => {
          // For installment invoices with discount: line item amounts are already post-discount.
          // We need to inflate them back to pre-discount values so QB can show Subtotal - Discount = Total.
          const needsInflation = invoiceCountToCreate > 1 && discount > 0 && totalAmount > 0;
          const inflationFactor = needsInflation ? baseAmount / totalAmount : 1;

          return lineItems.map((item) => ({
            description: item.description,
            amount: Math.max(0.01, Number((item.amount * inflationFactor).toFixed(2))),
            itemRef: item.serviceItemId,
          }));
        })(),
        // Calculate proportional discount for this invoice
        discount: (() => {
          if (discount <= 0) return undefined;
          if (invoiceCountToCreate === 1) {
            // Single invoice gets the full discount
            return discount;
          }
          // For installments: proportional discount based on this invoice's share of the total
          if (totalAmount > 0) {
            const proportionalDiscount = Number((discount * (invoiceAmount / totalAmount)).toFixed(2));
            return proportionalDiscount > 0 ? proportionalDiscount : undefined;
          }
          return undefined;
        })(),
        // Add billing address from customer record
        billingAddress: {
          line1: customer.address || undefined,
          city: customer.city || undefined,
          state: customer.state || undefined,
          postalCode: customer.zipCode || undefined,
          country: customer.country || "USA",
        },
      };

      console.log('[INVOICE_CREATE] QB Invoice data with discount and billing address:', {
        invoiceNumber,
        discount: qbInvoiceData.discount,
        billingAddress: qbInvoiceData.billingAddress,
      });

      // Validate QB invoice data before API call
      if (!qbInvoiceData.lineItems || qbInvoiceData.lineItems.length === 0) {
        throw new Error('Invoice must have at least one line item');
      }

      for (const item of qbInvoiceData.lineItems) {
        if (!item.itemRef || item.itemRef === 'demo-service-1' || item.itemRef === 'demo-service-2') {
          console.error('[INVOICE_CREATE] Invalid itemRef:', item.itemRef);
          throw new Error(`Invalid service item ID: ${item.itemRef}. Please select a valid QuickBooks service item.`);
        }
        if (!item.amount || item.amount <= 0) {
          throw new Error(`Invalid amount for line item: ${item.amount}`);
        }
      }

      console.log('[INVOICE_CREATE] QB Invoice payload:', JSON.stringify(qbInvoiceData, null, 2));

      // Create invoice in QuickBooks WITH BillEmail set during creation
      const qbInvoice = await quickbooksService.createInvoiceWithBillEmail(qbInvoiceData);
      qbInvoiceId = qbInvoice.Id;
      // invoiceNumber already set above with professional format

      console.log(`[INVOICE_CREATE] Invoice ${qbInvoice.Id} created in QB with status: ${qbInvoice.EmailStatus}`);

      // Determine if this invoice should be emailed immediately
      // LOGIC:
      // - Single payment (a vista): ALWAYS send immediately (customer needs to pay, due date is deadline not delivery date)
      // - Entry invoice: Send immediately (customer needs to pay TODAY)
      // - Installments (non-entry): Schedule (cron sends 5 days before each installment due date)
      const isInstallmentSeries = invoiceCountToCreate > 1;
      const isEntryInvoice = entryAmount > 0 && i === 1;
      const isSingleInvoice = invoiceCountToCreate === 1 && !isInstallmentSeries;

      // Single invoices and entry invoices are always sent immediately.
      // Only installments (future recurring payments) are scheduled via cron.
      const shouldSendEmail = isSingleInvoice || isEntryInvoice;

      console.log(`[INVOICE_CREATE] Email decision for invoice ${i}/${invoiceCountToCreate}:`, {
        isInstallmentSeries,
        isSingleInvoice,
        isSinglePayment,
        isEntryInvoice,
        shouldSendEmail,
        dueDate: invoiceDueDate.toISOString().split('T')[0],
        description: invoiceDescription,
      });

      // QB does NOT auto-send with EmailStatus: "NeedToSend" - must call /send explicitly
      if (customer.email && shouldSendEmail) {
        // Wait longer for QB to fully process the invoice before sending (increased from 500ms to 1000ms)
        await new Promise(resolve => setTimeout(resolve, 1000));

        try {
          console.log(`[INVOICE_CREATE] Calling QB /send endpoint for invoice ${qbInvoice.Id} to ${customer.email}...`);
          console.log(`[INVOICE_CREATE] Invoice BillEmail check before send - QB Invoice ID: ${qbInvoice.Id}, Email: ${qbInvoice.BillEmail?.Address || 'NOT SET'}`);

          // Call sendInvoice which calls QB's /send endpoint with retry logic
          // Note: sendInvoice now returns graceful failure instead of throwing
          // This allows invoice creation to complete even if /send fails
          const sendResult = await quickbooksService.sendInvoice(qbInvoice.Id, customer.email);

          console.log(`[INVOICE_CREATE] QB /send result:`, JSON.stringify(sendResult, null, 2));

          // Log send result (success or graceful failure)
          if (sendResult.success && sendResult.sent) {
            console.log(`[INVOICE_CREATE] ✓ Invoice email sent immediately via QB API (attempt ${sendResult.attempt})`);
            await prisma.integrationLog.create({
              data: {
                service: "quickbooks",
                action: "invoice_email_sent",
                status: "SUCCESS",
                payload: {
                  qbInvoiceId: qbInvoice.Id,
                  invoiceNumber,
                  recipientEmail: customer.email,
                  deliveryInfo: sendResult.deliveryInfo,
                  emailStatus: sendResult.emailStatus,
                  sendAttempts: sendResult.attempt,
                  isInstallment: isInstallmentSeries,
                  isEntryInvoice,
                  isSinglePayment,
                } as any,
              },
            });

            // Set email tracking variables for invoice creation
            emailSentAt = new Date();
            emailSendAttempts = 1;
          } else {
            // Send failed after retries - create NEEDS_MANUAL_SEND log entry
            console.log(`[INVOICE_CREATE] ⚠️  Invoice email send failed after ${sendResult.attempts} attempts`);
            await prisma.integrationLog.create({
              data: {
                service: "quickbooks",
                action: "invoice_needs_manual_send",
                status: "NEEDS_MANUAL_SEND",
                error: sendResult.error,
                payload: {
                  qbInvoiceId: qbInvoice.Id,
                  invoiceNumber,
                  recipientEmail: customer.email,
                  emailStatus: sendResult.emailStatus,
                  sendAttempts: sendResult.attempts,
                  note: "Invoice created but email send failed after retries. Manual send required via QuickBooks UI.",
                  qbInvoiceUrl: `https://app.qbo.intuit.com/app/invoice?txnId=${qbInvoice.Id}`,
                  isInstallment: isInstallmentSeries,
                  isEntryInvoice,
                  isSinglePayment,
                } as any,
              },
            });

            // Set email tracking variables for invoice creation
            emailSendAttempts = sendResult.attempts || 1;
            lastEmailSendError = sendResult.error || "Unknown error";
          }
        } catch (sendError: any) {
          // Shouldn't happen since sendInvoice is now non-throwing, but keep as safety net
          console.error(`[INVOICE_CREATE] QB send error (non-critical):`, sendError.message || String(sendError));

          await prisma.integrationLog.create({
            data: {
              service: "quickbooks",
              action: "invoice_needs_manual_send",
              status: "NEEDS_MANUAL_SEND",
              error: sendError.message || "Send error",
              payload: {
                qbInvoiceId: qbInvoice.Id,
                invoiceNumber,
                recipientEmail: customer.email,
                note: "Invoice created but email send failed. Manual send required via QuickBooks UI.",
                qbInvoiceUrl: `https://app.qbo.intuit.com/app/invoice?txnId=${qbInvoice.Id}`,
                isInstallment: isInstallmentSeries,
                isEntryInvoice,
                isSinglePayment,
              } as any,
            },
          });
        }
      } else if (customer.email && !shouldSendEmail) {
        // Installment invoice - schedule for cron to send 5 days before due date
        const sendDate = new Date(invoiceDueDate.getTime() - 5 * 24 * 60 * 60 * 1000);
        console.log(`[INVOICE_CREATE] Scheduled installment invoice ${i}/${invoiceCountToCreate} for ${sendDate.toISOString().split('T')[0]} (5 days before due: ${invoiceDueDate.toISOString().split('T')[0]})`);

        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "installment_invoice_scheduled",
            status: "SUCCESS",
            payload: {
              qbInvoiceId: qbInvoice.Id,
              recipientEmail: customer.email,
              dueDate: invoiceDueDate.toISOString(),
              installmentNumber: i,
              totalInstallments: invoiceCountToCreate,
              scheduledSendDate: sendDate.toISOString(),
            } as any,
          },
        });
      } else {
        console.warn(`[INVOICE_CREATE] ⚠️  Customer ${customer.name} has no email, invoice created but NOT sent`);

        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "invoice_created_without_email",
            status: "WARNING",
            payload: {
              qbInvoiceId: qbInvoice.Id,
              customerId: customer.id,
              customerName: customer.name,
              isInstallment: isInstallmentSeries,
              isEntryInvoice,
              isSinglePayment,
            } as any,
          },
        });
      }

      // Save invoice to local database
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          amount: invoiceAmount,
          dueDate: invoiceDueDate,
          status: InvoiceStatus.SENT,
          quickbooks_invoice_id: qbInvoiceId,
          ownerId: userId,
          dealId,
          customerId,
          lineItems: lineItems as any,
          // Email tracking fields
          emailSentAt,
          emailSendAttempts,
          lastEmailSendError,
          ...(invoiceCountToCreate > 1 && {
            installments: {
              seriesId,
              current: i,
              total: invoiceCountToCreate,
              isFirstInstallment: i === 1,
            } as any,
          }),
        },
      });

      // **REALTIME SYNC**: Immediately sync invoice back from QuickBooks to get latest status
      if (qbInvoiceId) {
        try {
          const { quickbooksSyncService } = await import('@/lib/services/quickbooks-sync.service');
          await quickbooksSyncService.syncSingleInvoice(qbInvoiceId);
          console.log(`[INVOICE_CREATE] Invoice ${qbInvoiceId} synced from QuickBooks`);
        } catch (syncError) {
          console.error(`[INVOICE_CREATE] Failed to sync invoice ${qbInvoiceId} from QuickBooks:`, syncError);
          // Don't fail invoice creation if sync fails - cron will catch it later
        }
      }

      invoices.push(invoice);

      // Log to IntegrationLog if synced to QB
      if (qbInvoiceId) {
        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "invoice_created_and_sent",
            status: "SUCCESS",
            payload: {
              invoiceId: invoice.id,
              qbInvoiceId,
              isInstallment: invoiceCountToCreate > 1,
              installmentNumber: i,
              totalInstallments: invoiceCountToCreate,
              seriesId,
            } as any,
          },
        });
      }
    }

    // Schedule DocuSign contract for first invoice in series (7-minute delay)
    // This gives QuickBooks email time to deliver before contract arrives
    if (invoiceCountToCreate > 0) {
      try {
        // Only schedule contract for first invoice in series
        const firstInvoice = invoices[0];

        // Trigger contract workflow with 7-minute delay (fire-and-forget)
        // First-invoice detection and duplicate prevention happen in the service
        contractWorkflowService.triggerContractAfterDelay(firstInvoice.id, 7).catch(err => {
          console.error('[INVOICE_CREATE] Failed to schedule contract generation:', err);
          // Don't fail invoice creation if contract scheduling fails
          // Finance team can manually trigger contract via UI if needed
        });

        console.log(`[INVOICE_CREATE] ✓ Contract generation scheduled for invoice ${firstInvoice.id} (7 min delay)`);

        // Log contract scheduling
        await prisma.integrationLog.create({
          data: {
            service: "CONTRACT_WORKFLOW",
            action: "CONTRACT_SCHEDULED",
            status: "SUCCESS",
            payload: {
              invoiceId: firstInvoice.id,
              userRole: role,
              qbInvoiceId: firstInvoice.quickbooks_invoice_id,
              delayMinutes: 7,
              isInstallmentSeries: invoiceCountToCreate > 1,
              installmentPosition: 1,
              totalInstallments: invoiceCountToCreate,
            } as any,
          },
        });
      } catch (contractError: any) {
        console.error(`[INVOICE_CREATE] ✗ DocuSign contract generation failed:`, contractError);

        // Log error but don't fail invoice creation (non-blocking)
        await prisma.integrationLog.create({
          data: {
            service: "CONTRACT_WORKFLOW",
            action: "CONTRACT_SEND_FAILED",
            status: "ERROR",
            error: contractError.message || "Unknown error",
            payload: {
              invoiceId: invoices[0].id,
              userRole: role,
              errorType: contractError.constructor.name,
            } as any,
          },
        });
      }
    }

    // NEW: Sync first invoice to Pipedrive deal (await to prevent Vercel container shutdown)
    // CRITICAL: Must await before response to avoid socket close errors in serverless
    if (invoiceCountToCreate > 0 && invoices[0]) {
      const firstInvoice = invoices[0];
      try {
        await invoiceWorkflowService.syncInvoiceToPipedriveDeal(firstInvoice.id);
        console.log("[INVOICE_CREATE] ✓ Pipedrive sync completed successfully");
      } catch (error) {
        // Log but don't fail invoice creation - sync can be retried later
        console.error("[INVOICE_CREATE] ✗ Pipedrive sync failed (non-blocking):", error);
      }
    }

    // Auto-create ClientUser for hub access
    // DISABLED: Hub is in testing phase. Enable when ready to go live.
    // Set HUB_AUTO_CREATE_ENABLED=true in env to activate.
    if (process.env.HUB_AUTO_CREATE_ENABLED === "true") {
      try {
        const { prisma: db } = await import("@/lib/db");
        const { generateTempPassword, hashPassword } = await import("@/lib/hub-auth");
        const { notificationService } = await import("@/lib/services/notification.service");

        const existingClientUser = await db.clientUser.findUnique({
          where: { customerId: customer.id },
        });

        if (!existingClientUser) {
          const tempPassword = generateTempPassword();
          const passwordHash = await hashPassword(tempPassword);
          await db.clientUser.create({
            data: {
              email: customer.email,
              passwordHash,
              mustResetPw: true,
              tempPasswordExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
              customerId: customer.id,
              language: customer.preferredLanguage === "pt-BR" ? "pt-BR" : "en",
            },
          });
          await notificationService.sendHubWelcome(customer, tempPassword);
          console.log(`[INVOICE_CREATE] ClientUser created for ${customer.email}`);
        } else {
          // Send "new invoice available" notification
          await notificationService.sendHubInvoiceAvailable(customer, invoices[0]);
          console.log(`[INVOICE_CREATE] Hub invoice notification sent to ${customer.email}`);
        }
      } catch (hubError: any) {
        console.error("[INVOICE_CREATE] Hub account setup failed:", hubError.message);
      }
    }

    return NextResponse.json({
      message: `${invoiceCountToCreate} invoice(s) created successfully`,
      invoices,
      seriesId: invoiceCountToCreate > 1 ? seriesId : null,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating invoice:", error);

    if (error instanceof z.ZodError) {
      console.error("Zod validation error:", error.flatten());
      return NextResponse.json({
        error: "Invalid payload",
        details: error.flatten().fieldErrors
      }, { status: 400 });
    }

    // Log detalhado do erro
    console.error("Invoice creation failed:", {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });

    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
