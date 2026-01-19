import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

const createInvoiceSchema = z.object({
  customerId: z.string(),
  dealId: z.string().optional(),
  serviceItemId: z.string(),
  quantity: z.number().min(1).default(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).optional(),
  entryAmount: z.number().min(0).optional(),
  installments: z.number().min(0).max(12).optional(),
  dueDate: z.string().datetime().optional(),
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

    // Role-based approval workflow
    const needsApproval = role === "SALES" || role === "COMMERCIAL";
    const isFinanceOrAdmin = role === "FINANCE" || role === "ADMIN";

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

      if (needsApproval) {
        // SALES/COMMERCIAL role: Create draft invoice pending approval
        const timestamp = Date.now();
        invoiceNumber = `DRAFT-${timestamp}-${i}`;
      } else {
        // FINANCE/ADMIN: Auto-approve and sync to QuickBooks immediately
        await quickbooksService.initialize();

        // Create customer in QuickBooks if necessary
        const qbCustomer = await quickbooksService.getOrCreateCustomer({
          email: customer.email,
          name: customer.name,
          phone: customer.phone || undefined,
        });

        // Prepare QB invoice data
        const qbInvoiceData: any = {
          customerId: qbCustomer.Id,
          dueDate: invoiceDueDate,
          lineItems: [{
            description: invoiceDescription,
            amount: invoiceAmount,
            itemRef: data.serviceItemId,
          }],
        };

        // Create invoice in QuickBooks
        const qbInvoice = await quickbooksService.createInvoice(qbInvoiceData);
        qbInvoiceId = qbInvoice.Id;
        invoiceNumber = qbInvoice.DocNumber || qbInvoice.Id;

        // Send invoice via QB email
        try {
          await quickbooksService.sendInvoice(qbInvoice.Id, customer.email);
        } catch (emailError) {
          console.error(`Failed to send QB invoice email for ${qbInvoice.Id}:`, emailError);
          // Don't fail the whole operation if email fails
        }
      }

      // Save invoice to local database
      const invoice = await prisma.invoice.create({
        data: {
          invoiceNumber,
          amount: invoiceAmount,
          dueDate: invoiceDueDate,
          status: needsApproval ? InvoiceStatus.DRAFT : InvoiceStatus.SENT,
          approvalStatus: needsApproval ? "PENDING" : "APPROVED",
          approvedBy: needsApproval ? undefined : userId,
          approvedAt: needsApproval ? undefined : new Date(),
          quickbooks_invoice_id: qbInvoiceId,
          ownerId: userId,
          dealId,
          customerId,
          lineItems: lineItems as any,
          installments: invoiceCountToCreate > 1 ? {
            seriesId,
            current: i,
            total: invoiceCountToCreate,
            priceLevelId: data.priceLevelId,
            paymentTermId: data.paymentTermId,
          } : null,
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
      return NextResponse.json({ error: "Invalid payload", details: error.flatten() }, { status: 400 });
    }

    return NextResponse.json(
      { error: error.message || "Failed to create invoice" },
      { status: 500 }
    );
  }
}
