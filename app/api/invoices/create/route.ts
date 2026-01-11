import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";
import { z } from "zod";

const createInvoiceSchema = z.object({
  customerId: z.string(),
  dealId: z.string(),
  serviceItemId: z.string(),
  quantity: z.number().min(1).default(1),
  unitPrice: z.number().min(0),
  discount: z.number().min(0).optional(),
  entryAmount: z.number().min(0).optional(),
  installments: z.number().min(0).optional(),
  dueDate: z.string().datetime().optional(),
  description: z.string().optional(),
});

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  const userId = (session.user as any).id;
  const allowedRoles = ["ADMIN", "FINANCE", "SALES"];
  if (!allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const data = createInvoiceSchema.parse(body);

    const { customerId, dealId } = data;

    // Garantir que customer e deal existem
    const [customer, deal] = await Promise.all([
      prisma.customer.findUnique({ where: { id: customerId } }),
      prisma.deal.findUnique({ where: { id: dealId } }),
    ]);

    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    // Calcular linhas e total
    const baseAmount = data.unitPrice * data.quantity;
    const discount = data.discount || 0;
    let total = Math.max(0, baseAmount - discount);

    const entryAmount = data.entryAmount || 0;
    const installments = data.installments || 0;
    const remaining = Math.max(0, total - entryAmount);

    const lineItems: Array<{ description: string; amount: number; itemRef?: string }> = [];

    if (entryAmount > 0) {
      lineItems.push({
        description: data.description || "Entrada",
        amount: entryAmount,
        itemRef: data.serviceItemId,
      });
    }

    if (installments > 0) {
      const installmentAmount = remaining / installments;
      for (let i = 1; i <= installments; i++) {
        lineItems.push({
          description: `Parcela ${i}/${installments}`,
          amount: Number(installmentAmount.toFixed(2)),
          itemRef: data.serviceItemId,
        });
      }
    } else {
      // Sem parcelamento, usar total restante
      lineItems.push({
        description: data.description || "Serviço",
        amount: remaining || total,
        itemRef: data.serviceItemId,
      });
    }

    // Role-based approval workflow
    const needsApproval = role === "SALES";
    let qbInvoiceId: string | undefined;
    let invoiceNumber: string;

    if (needsApproval) {
      // SALES role: Create draft invoice pending approval
      // Generate temporary invoice number
      const timestamp = Date.now();
      invoiceNumber = `DRAFT-${timestamp}`;
    } else {
      // FINANCE/ADMIN: Auto-approve and sync to QuickBooks
      // Criar customer no QuickBooks se necessário
      const qbCustomer = await quickbooksService.getOrCreateCustomer({
        email: customer.email,
        name: customer.name,
        phone: customer.phone || undefined,
      });

      // Criar invoice no QuickBooks
      const qbInvoice = await quickbooksService.createInvoice({
        customerId: qbCustomer.Id,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        lineItems,
      });

      qbInvoiceId = qbInvoice.Id;
      invoiceNumber = qbInvoice.DocNumber || qbInvoice.Id;
    }

    // Salvar invoice local
    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        amount: total,
        dueDate: data.dueDate ? new Date(data.dueDate) : new Date(),
        status: needsApproval ? InvoiceStatus.DRAFT : InvoiceStatus.SENT,
        approvalStatus: needsApproval ? "PENDING" : "APPROVED",
        approvedBy: needsApproval ? undefined : userId,
        approvedAt: needsApproval ? undefined : new Date(),
        quickbooks_invoice_id: qbInvoiceId,
        dealId,
        customerId,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
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
