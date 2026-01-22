import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";

const createInvoiceSchema = z.object({
  customerId: z.string(),
  dealId: z.string().optional(),
  serviceItemId: z.string(),
  quantity: z.number().min(1).default(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).optional(),
  entryAmount: z.number().min(0).optional(),
  installments: z.number().min(0).max(12).optional(),
  dueDate: z.string().optional(), // Aceita string de data simples (YYYY-MM-DD)
  description: z.string().optional(),
  priceLevelId: z.string().optional(),
  paymentTermId: z.string().optional(),
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
    const baseAmount = data.unitPrice * data.quantity;
    const discount = data.discount || 0;
    const totalAmount = Math.max(0, baseAmount - discount);

    const entryAmount = data.entryAmount || 0;
    const installmentCount = data.installments || 0;
    const remaining = Math.max(0, totalAmount - entryAmount);

    // Generate series ID for linking installments
    const seriesId = `SERIES-${Date.now()}`;
    const invoices: any[] = [];

    // Determine number of invoices to create
    let invoiceCountToCreate = 1;
    if (entryAmount > 0 && installmentCount > 0) {
      // Entry + installments = 1 entry invoice + N installment invoices
      invoiceCountToCreate = 1 + installmentCount;
    } else if (installmentCount > 0) {
      // Just installments = N invoices
      invoiceCountToCreate = installmentCount;
    }

    // Create multiple invoices (one per installment)
    for (let i = 1; i <= invoiceCountToCreate; i++) {
      let invoiceAmount: number;
      let invoiceDescription: string;
      let invoiceDueDate: Date;

      // Calculate amount and description based on position
      if (entryAmount > 0 && i === 1) {
        // First invoice is the entry
        invoiceAmount = entryAmount;
        invoiceDescription = `${data.description || 'Service'} - Entry Payment`;
        invoiceDueDate = data.dueDate ? new Date(data.dueDate) : new Date();
      } else if (installmentCount > 0) {
        // Subsequent invoices are installments
        const installmentAmount = remaining / installmentCount;
        const installmentNumber = entryAmount > 0 ? i - 1 : i;
        invoiceAmount = Number(installmentAmount.toFixed(2));
        invoiceDescription = `${data.description || 'Service'} - Installment ${installmentNumber} of ${installmentCount}`;

        // Calculate due date (monthly installments)
        invoiceDueDate = data.dueDate ? new Date(data.dueDate) : new Date();
        const monthsToAdd = entryAmount > 0 ? i - 1 : i - 1;
        invoiceDueDate.setMonth(invoiceDueDate.getMonth() + monthsToAdd);
      } else {
        // Single invoice (no installments)
        invoiceAmount = totalAmount;
        invoiceDescription = data.description || 'Service';
        invoiceDueDate = data.dueDate ? new Date(data.dueDate) : new Date();
      }

      // Prepare line items for this invoice
      const lineItems = [{
        description: invoiceDescription,
        quantity: 1,
        unitPrice: invoiceAmount,
        amount: invoiceAmount,
        serviceItemId: data.serviceItemId,
      }];

      let qbInvoiceId: string | undefined;
      let invoiceNumber: string;

      // Generate professional invoice number for all invoices
      invoiceNumber = generateInvoiceNumber({
        customerName: customer.name,
        date: invoiceDueDate,
        sequence: i,
      });

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
        lineItems: [{
          description: invoiceDescription,
          amount: invoiceAmount,
          itemRef: data.serviceItemId,
        }],
      };

      // Create invoice in QuickBooks WITH BillEmail set during creation
      const qbInvoice = await quickbooksService.createInvoiceWithBillEmail(qbInvoiceData);
      qbInvoiceId = qbInvoice.Id;
      // invoiceNumber already set above with professional format

      // Send invoice via QB email (already has email set from creation)
      if (customer.email) {
        try {
          console.log(`[INVOICE_CREATE] Attempting to send QB invoice ${qbInvoice.Id} to ${customer.email}...`);
          const sendResult = await quickbooksService.sendInvoice(qbInvoice.Id, customer.email);
          console.log(`[INVOICE_CREATE] ✓ Successfully sent QB invoice email for ${qbInvoice.Id}`, sendResult);

          // Log email sent to IntegrationLog
          await prisma.integrationLog.create({
            data: {
              service: "quickbooks",
              action: "invoice_email_sent",
              status: "SUCCESS",
              payload: {
                qbInvoiceId: qbInvoice.Id,
                recipientEmail: customer.email,
                sendResult,
              } as any,
            },
          });
        } catch (emailError: any) {
          console.error(`[INVOICE_CREATE] ✗ Failed to send QB invoice email for ${qbInvoice.Id}:`, {
            error: emailError.message,
            stack: emailError.stack,
            email: customer.email,
          });

          // Log email failure to IntegrationLog
          await prisma.integrationLog.create({
            data: {
              service: "quickbooks",
              action: "invoice_email_failed",
              status: "ERROR",
              error: emailError.message || "Unknown error",
              payload: {
                qbInvoiceId: qbInvoice.Id,
                customerEmail: customer.email,
              } as any,
            },
          });

          // Don't fail the whole operation if email fails
        }
      } else {
        // Customer has no email - skip email sending but log warning
        console.warn(`[INVOICE_CREATE] ⚠️  Customer ${customer.name} has no email, skipping invoice email send`);

        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "invoice_email_skipped",
            status: "SUCCESS",
            payload: {
              qbInvoiceId: qbInvoice.Id,
              customerId: customer.id,
              customerName: customer.name,
              reason: "Customer has no email address",
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
          approvalStatus: "APPROVED",
          approvedBy: userId,
          approvedAt: new Date(),
          quickbooks_invoice_id: qbInvoiceId,
          ownerId: userId,
          dealId,
          customerId,
          lineItems: lineItems as any,
          ...(invoiceCountToCreate > 1 && {
            installments: {
              seriesId,
              current: i,
              total: invoiceCountToCreate,
              priceLevelId: data.priceLevelId,
              paymentTermId: data.paymentTermId,
            } as any,
          }),
        },
      });

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
