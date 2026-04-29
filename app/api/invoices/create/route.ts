import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";
import { invoiceWorkflowService } from "@/lib/services/invoice-workflow.service";
import { addMonths, parseLocalDate } from "@/lib/utils/date";
import {
  getProductsFromCatalogProductIds,
  validatePaymentSelection,
} from "@/lib/invoices/payment-rules";

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
        catalogProductId: z.string().optional(),
        serviceItemId: z.string(),
        quantity: z.number().min(1),
        unitPrice: z.number().min(0),
        description: z.string().optional(),
      })
    )
    .min(1),
  discount: z.number().min(0).optional(),
  entryAmount: z.number().min(0).optional(),
  installments: z.number().int().min(0).max(12).optional(),
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
  const allowedRoles = ["ADMIN", "FINANCE", "COMMERCIAL"];
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
    const selectedCatalogProducts = getProductsFromCatalogProductIds(
      data.items.map((item) => item.catalogProductId)
    );

    validatePaymentSelection({
      products: selectedCatalogProducts,
      entryAmount,
      installments: installmentCount,
      totalAmount,
    });

    // Derive service name: use description field, or first item name, or fallback
    const serviceName = data.description
      || data.items[0]?.description
      || 'Serviço';

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
        invoiceDescription = `${serviceName} - Entry Payment`;
        invoiceDueDate = data.dueDate ? parseLocalDate(data.dueDate) : todayUTCNoon();
      } else if (entryAmount > 0 && i > 1) {
        // INSTALLMENT INVOICE (when entry exists): i=2 → Installment 1, i=3 → Installment 2
        const installmentAmount = remaining / installmentCount;
        const installmentNumber = i - 1; // i=2 is "Installment 1"
        invoiceAmount = Number(installmentAmount.toFixed(2));
        invoiceDescription = `${serviceName} - Installment ${installmentNumber} of ${installmentCount}`;

        // Calculate due date: i=2 → +1 month, i=3 → +2 months
        const baseDueDate = data.dueDate ? parseLocalDate(data.dueDate) : todayUTCNoon();
        const monthsToAdd = i - 1; // i=2 → +1 month
        invoiceDueDate = addMonths(baseDueDate, monthsToAdd);
      } else if (installmentCount > 0) {
        // INSTALLMENT INVOICE (no entry): i=1 → Installment 1, i=2 → Installment 2
        const installmentAmount = totalAmount / installmentCount;
        invoiceAmount = Number(installmentAmount.toFixed(2));
        invoiceDescription = `${serviceName} - Installment ${i} of ${installmentCount}`;

        // Calculate due date: i=1 → +0 months, i=2 → +1 month
        const baseDueDate = data.dueDate ? parseLocalDate(data.dueDate) : todayUTCNoon();
        const monthsToAdd = i - 1;
        invoiceDueDate = addMonths(baseDueDate, monthsToAdd);
      } else {
        // Single invoice (no installments, no entry split)
        invoiceAmount = totalAmount;
        invoiceDescription = serviceName;
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
            description: `${serviceName} - Entry Payment`,
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
            description: `${serviceName} - Installment ${installmentNum} of ${installmentCount}`,
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
            description: `${serviceName} - Installment ${i} of ${installmentCount}`,
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

    // Resolve QB customer once before the loop — avoids N redundant API round-trips
    await quickbooksService.initialize();

    const qbCustomer = await quickbooksService.getOrCreateCustomer({
      email: customer.email,
      name: customer.name,
      phone: customer.phone || undefined,
    });

    if (customer.email) {
      const emailVerified = await quickbooksService.ensureCustomerEmail(qbCustomer.Id, customer.email);
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

    // ── STEP A: Create the FIRST invoice in QB (entry or first installment) ──
    const firstMeta = invoiceMetadata[0];
    const firstLineItems = firstMeta.lineItems.map((item) => ({
      description: item.description,
      amount: Math.max(0.01, Number(item.amount.toFixed(2))),
      itemRef: item.serviceItemId,
    }));

    for (const item of firstLineItems) {
      if (!item.itemRef || item.itemRef === "demo-service-1" || item.itemRef === "demo-service-2") {
        throw new Error(`Invalid service item ID: ${item.itemRef}. Please select a valid QuickBooks service item.`);
      }
    }

    const qbInvoice = await quickbooksService.createInvoiceWithBillEmail({
      customerId: qbCustomer.Id,
      customerEmail: customer.email,
      dueDate: firstMeta.dueDate,
      docNumber: firstMeta.number,
      emailStatus: "NeedToSend",
      lineItems: firstLineItems,
      discount: discount > 0 ? (invoiceCountToCreate === 1 ? discount : Number((discount * (firstMeta.amount / totalAmount)).toFixed(2)) || undefined) : undefined,
      billingAddress: {
        line1: customer.address || undefined,
        city: customer.city || undefined,
        state: customer.state || undefined,
        postalCode: customer.zipCode || undefined,
        country: customer.country || "USA",
      },
    });

    console.log(`[INVOICE_CREATE] First invoice ${qbInvoice.Id} created in QB`);

    // Send first invoice email
    let firstEmailSentAt: Date | undefined;
    let firstEmailAttempts = 0;
    let firstEmailError: string | undefined;

    if (customer.email) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      try {
        const sendResult = await quickbooksService.sendInvoice(qbInvoice.Id, customer.email);
        if (sendResult.success && sendResult.sent) {
          console.log(`[INVOICE_CREATE] ✓ First invoice emailed to ${customer.email}`);
          firstEmailSentAt = new Date();
          firstEmailAttempts = 1;
          await prisma.integrationLog.create({
            data: { service: "quickbooks", action: "invoice_email_sent", status: "SUCCESS", payload: { qbInvoiceId: qbInvoice.Id, invoiceNumber: firstMeta.number, recipientEmail: customer.email } as any },
          });
        } else {
          firstEmailAttempts = sendResult.attempts || 1;
          firstEmailError = sendResult.error || "QB send failed";
          await prisma.integrationLog.create({
            data: { service: "quickbooks", action: "invoice_needs_manual_send", status: "NEEDS_MANUAL_SEND", error: firstEmailError, payload: { qbInvoiceId: qbInvoice.Id, invoiceNumber: firstMeta.number, recipientEmail: customer.email } as any },
          });
        }
      } catch (sendError: any) {
        firstEmailError = sendError.message || "Send error";
        await prisma.integrationLog.create({
          data: { service: "quickbooks", action: "invoice_needs_manual_send", status: "NEEDS_MANUAL_SEND", error: firstEmailError, payload: { qbInvoiceId: qbInvoice.Id, invoiceNumber: firstMeta.number } as any },
        });
      }
    }

    // Save first invoice locally
    const firstInvoice = await prisma.invoice.create({
      data: {
        invoiceNumber: firstMeta.number,
        amount: firstMeta.amount,
        dueDate: firstMeta.dueDate,
        status: InvoiceStatus.SENT,
        quickbooks_invoice_id: qbInvoice.Id,
        ownerId: userId,
        dealId,
        customerId,
        lineItems: firstMeta.lineItems as any,
        emailSentAt: firstEmailSentAt,
        emailSendAttempts: firstEmailAttempts,
        lastEmailSendError: firstEmailError,
        ...(invoiceCountToCreate > 1 && {
          installments: { seriesId, current: 1, total: invoiceCountToCreate, isFirstInstallment: true } as any,
        }),
      },
    });
    invoices.push(firstInvoice);

    // Sync first invoice from QB
    try {
      const { quickbooksSyncService } = await import("@/lib/services/quickbooks-sync.service");
      await quickbooksSyncService.syncSingleInvoice(qbInvoice.Id);
    } catch {
      // non-critical
    }

    // ── STEP B: Create RecurringTransaction for installments 2-N ──
    if (invoiceCountToCreate > 1) {
      const installmentAmount = Number((remaining / installmentCount).toFixed(2));
      const firstInstallmentDueDate = invoiceMetadata[1].dueDate;
      let recurringTemplateId: string | undefined;

      // Create RecurringTransaction so QB auto-creates each installment on schedule.
      // Finance sees the template in Sales → Recurring Transactions for AR planning.
      // Customer only sees each invoice when QB creates it on the scheduled date.
      try {
        const recurring = await quickbooksService.createRecurringInvoice({
          templateName: `${serviceName} - ${customer.name} (${new Date().toISOString().slice(0, 10)})`.slice(0, 100),
          customerId: qbCustomer.Id,
          customerEmail: customer.email,
          installmentAmount,
          installmentCount: invoiceCountToCreate - 1,
          startDate: firstInstallmentDueDate,
          itemRef: data.items[0].serviceItemId,
          serviceName,
          billingAddress: {
            line1: customer.address || undefined,
            city: customer.city || undefined,
            state: customer.state || undefined,
            postalCode: customer.zipCode || undefined,
            country: customer.country || "USA",
          },
        });

        recurringTemplateId = recurring.Id;
        console.log(`[INVOICE_CREATE] ✓ RecurringTransaction ${recurringTemplateId} created for ${invoiceCountToCreate - 1} installments`);

        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "recurring_invoice_template_created",
            status: "SUCCESS",
            payload: {
              recurringTemplateId,
              seriesId,
              installmentCount: invoiceCountToCreate - 1,
              installmentAmount,
              startDate: firstInstallmentDueDate.toISOString(),
              customerName: customer.name,
            } as any,
          },
        });
      } catch (recurError: any) {
        console.error(`[INVOICE_CREATE] RecurringTransaction failed, installments saved as DRAFT:`, recurError.message);
        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "recurring_invoice_template_failed",
            status: "ERROR",
            error: recurError.message,
            payload: { seriesId, customerName: customer.name } as any,
          },
        });
      }

      // Save future installments locally as DRAFT for dashboard visibility.
      // QB auto-creates the real invoices via the recurring template.
      for (let i = 1; i < invoiceCountToCreate; i++) {
        const meta = invoiceMetadata[i];
        const draftInvoice = await prisma.invoice.create({
          data: {
            invoiceNumber: meta.number,
            amount: meta.amount,
            dueDate: meta.dueDate,
            status: InvoiceStatus.DRAFT,
            quickbooks_invoice_id: null,
            ownerId: userId,
            dealId,
            customerId,
            lineItems: meta.lineItems as any,
            installments: {
              seriesId,
              current: i + 1,
              total: invoiceCountToCreate,
              isFirstInstallment: false,
              recurringTemplateId,
            } as any,
          },
        });
        invoices.push(draftInvoice);
      }

      console.log(`[INVOICE_CREATE] Saved ${invoiceCountToCreate - 1} future installments as DRAFT`);
    }

    // NEW: Sync first invoice to Pipedrive deal (await to prevent Vercel container shutdown)

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
          // If customer has a payment method on file in QB Payments, send the
          // autopay-scheduled notification (explains the method + due date).
          // Otherwise fall back to the generic "new invoice" email.
          let sentAutopay = false;
          if (customer.quickbooks_id) {
            try {
              const { quickbooksService } = await import('@/lib/services/quickbooks.service');
              await quickbooksService.initialize();
              const method = await quickbooksService.getAutopayMethodFor(customer.quickbooks_id);
              if (method) {
                await notificationService.sendHubAutopayScheduled(
                  customer,
                  invoices[0],
                  { type: method.type, last4: method.last4, brand: method.brand }
                );
                sentAutopay = true;
                console.log(`[INVOICE_CREATE] Hub autopay notification sent to ${customer.email} (method ${method.type} ••${method.last4})`);
              }
            } catch (autopayErr: any) {
              console.error('[INVOICE_CREATE] Failed to check autopay method:', autopayErr.message);
            }
          }
          if (!sentAutopay) {
            await notificationService.sendHubInvoiceAvailable(customer, invoices[0]);
            console.log(`[INVOICE_CREATE] Hub invoice notification sent to ${customer.email}`);
          }
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
