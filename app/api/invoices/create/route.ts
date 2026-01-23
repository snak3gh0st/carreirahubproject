import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";
import { generateInvoiceNumber } from "@/lib/utils/invoice-number";
import { contractWorkflowService } from "@/lib/services/contract-workflow.service";

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

    // Track how many invoices we've generated per month in this batch
    // Key: "YYYY-MM", Value: count of invoices in this batch for that month
    const batchCountByMonth: Record<string, number> = {};

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
      const lineItems =
        invoiceCountToCreate === 1
          ? data.items.map((item) => ({
              description: item.description || invoiceDescription,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              amount: Number((item.unitPrice * item.quantity).toFixed(2)),
              serviceItemId: item.serviceItemId,
            }))
          : [
              {
                description: invoiceDescription,
                quantity: 1,
                unitPrice: invoiceAmount,
                amount: invoiceAmount,
                serviceItemId: data.items[0].serviceItemId,
              },
            ];

      // Count existing invoices for THIS invoice's due date month
      const monthStart = new Date(invoiceDueDate.getFullYear(), invoiceDueDate.getMonth(), 1);
      const monthEnd = new Date(invoiceDueDate.getFullYear(), invoiceDueDate.getMonth() + 1, 0);

      const existingInvoicesThisMonth = await prisma.invoice.count({
        where: {
          customerId: customer.id,
          createdAt: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
      });

      // Track how many invoices in THIS batch are for the same month
      const monthKey = `${invoiceDueDate.getFullYear()}-${String(invoiceDueDate.getMonth() + 1).padStart(2, '0')}`;
      const batchCountForThisMonth = batchCountByMonth[monthKey] || 0;
      batchCountByMonth[monthKey] = batchCountForThisMonth + 1;

      // Generate professional invoice number with sequential numbering
      // Sequence = existing invoices in DB + invoices already generated in this batch for same month
      const sequence = existingInvoicesThisMonth + batchCountForThisMonth + 1;
      const invoiceNumber = generateInvoiceNumber({
        customerName: customer.name,
        date: invoiceDueDate,
        sequence: sequence,
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
        monthKey,
        existingInDB: existingInvoicesThisMonth,
        batchCountForMonth: batchCountForThisMonth,
        sequence,
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
        lineItems: lineItems.map((item) => ({
          description: item.description,
          amount: item.amount,
          itemRef: item.serviceItemId,
        })),
      };

      // Create invoice in QuickBooks WITH BillEmail set during creation
      const qbInvoice = await quickbooksService.createInvoiceWithBillEmail(qbInvoiceData);
      qbInvoiceId = qbInvoice.Id;
      // invoiceNumber already set above with professional format

      console.log(`[INVOICE_CREATE] Invoice ${qbInvoice.Id} created in QB with status: ${qbInvoice.EmailStatus}`);

      // Determine if this invoice should be emailed immediately
      // ONLY send email for: (1) first installment OR (2) non-installment invoices
      const isInstallmentSeries = invoiceCountToCreate > 1;
      const isFirstInstallment = i === 1;
      const shouldSendEmail = !isInstallmentSeries || isFirstInstallment;

      console.log(`[INVOICE_CREATE] Email decision for invoice ${i}/${invoiceCountToCreate}:`, {
        isInstallmentSeries,
        isFirstInstallment,
        shouldSendEmail,
      });

      // QB does NOT auto-send with EmailStatus: "NeedToSend" - must call /send explicitly
      if (customer.email && shouldSendEmail) {
        // Wait a moment for QB to fully process the invoice before sending
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
          console.log(`[INVOICE_CREATE] Calling QB /send endpoint for invoice ${qbInvoice.Id} to ${customer.email}...`);

          // Call sendInvoice which calls QB's /send endpoint
          // Note: sendInvoice now returns graceful failure instead of throwing
          // This allows invoice creation to complete even if /send fails
          const sendResult = await quickbooksService.sendInvoice(qbInvoice.Id, customer.email);

          console.log(`[INVOICE_CREATE] QB /send result:`, JSON.stringify(sendResult, null, 2));

          // Log send result (success or graceful failure)
          // Invoice is already marked NeedToSend in QB, so it will be batch-sent automatically
          if (sendResult.success && sendResult.sent) {
            console.log(`[INVOICE_CREATE] ✓ Invoice email sent immediately via QB API`);
            await prisma.integrationLog.create({
              data: {
                service: "quickbooks",
                action: "invoice_email_sent",
                status: "SUCCESS",
                payload: {
                  qbInvoiceId: qbInvoice.Id,
                  recipientEmail: customer.email,
                  deliveryInfo: sendResult.deliveryInfo,
                  isInstallment: isInstallmentSeries,
                  isFirstInstallment,
                } as any,
              },
            });
          } else {
            console.log(`[INVOICE_CREATE] ⓘ Invoice created with NeedToSend status. QB will batch-send automatically.`);
            await prisma.integrationLog.create({
              data: {
                service: "quickbooks",
                action: "invoice_created_batch_send_queued",
                status: "SUCCESS",
                payload: {
                  qbInvoiceId: qbInvoice.Id,
                  recipientEmail: customer.email,
                  emailStatus: "NeedToSend",
                  note: "QB /send endpoint unavailable. Invoice queued for batch sending.",
                  error: sendResult.error,
                  isInstallment: isInstallmentSeries,
                  isFirstInstallment,
                } as any,
              },
            });
          }
        } catch (sendError: any) {
          // Shouldn't happen since sendInvoice is now non-throwing, but keep as safety net
          console.error(`[INVOICE_CREATE] QB send error (non-critical):`, sendError.message || String(sendError));

          await prisma.integrationLog.create({
            data: {
              service: "quickbooks",
              action: "invoice_created_send_error",
              status: "WARNING",
              error: sendError.message || "Send error",
              payload: {
                qbInvoiceId: qbInvoice.Id,
                recipientEmail: customer.email,
                isInstallment: isInstallmentSeries,
                isFirstInstallment,
              } as any,
            },
          });
        }
      } else if (customer.email && !shouldSendEmail) {
        // Subsequent installment - DO NOT send email now (will be sent 5 days before due date)
        console.log(`[INVOICE_CREATE] ⏱️  Installment invoice ${i}/${invoiceCountToCreate} created as DRAFT. Email will be sent 5 days before due date: ${invoiceDueDate.toISOString().split('T')[0]}`);

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
              scheduledSendDate: new Date(invoiceDueDate.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
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
              isFirstInstallment,
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

    // Send DocuSign contract for first invoice in any series (only if deal exists)
    if (invoiceCountToCreate > 0) {
      try {
        // Only send contract for first invoice in series (avoid duplicates for installments)
        const firstInvoice = invoices[0];

        // Get deal data if available (optional, not required)
        let dealData = null;
        if (firstInvoice.dealId) {
          dealData = await prisma.deal.findUnique({
            where: { id: firstInvoice.dealId },
            select: { id: true, title: true }
          });
        }

        // Only send contract if deal exists (contract requires dealId)
        if (dealData) {
          await contractWorkflowService.sendContractOnApproval({
            id: firstInvoice.id,
            invoiceNumber: firstInvoice.invoiceNumber,
            amount: firstInvoice.amount,
            dueDate: firstInvoice.dueDate,
            deal: dealData,
            customer: {
              id: customer.id,
              name: customer.name,
              email: customer.email,
              phone: customer.phone,
            },
          });

          console.log(`[INVOICE_CREATE] ✓ DocuSign contract sent for invoice ${firstInvoice.id}`);

          // Log successful contract generation
          await prisma.integrationLog.create({
            data: {
              service: "CONTRACT_WORKFLOW",
              action: "CONTRACT_SENT_ON_CREATE",
              status: "SUCCESS",
              payload: {
                invoiceId: firstInvoice.id,
                userRole: role,
                qbInvoiceId: firstInvoice.quickbooks_invoice_id,
                hasDeal: true,
                isInstallmentSeries: invoiceCountToCreate > 1,
                installmentPosition: 1,
                totalInstallments: invoiceCountToCreate,
              } as any,
            },
          });
        } else {
          console.log(`[INVOICE_CREATE] ⓘ Contract not sent - no deal linked to invoice ${firstInvoice.id}`);

          // Log that contract was skipped (informational)
          await prisma.integrationLog.create({
            data: {
              service: "CONTRACT_WORKFLOW",
              action: "CONTRACT_SKIPPED_NO_DEAL",
              status: "SUCCESS",
              payload: {
                invoiceId: firstInvoice.id,
                reason: "No deal associated with invoice",
              } as any,
            },
          });
        }
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
