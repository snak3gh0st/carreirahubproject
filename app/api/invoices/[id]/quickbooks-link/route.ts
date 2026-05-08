import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { InvoiceStatus } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { extractQuickbooksInvoiceLink } from "@/lib/quickbooks/invoice-link";
import { quickbooksService } from "@/lib/services/quickbooks.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  if (!["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"].includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      status: true,
      ownerId: true,
      quickbooks_invoice_id: true,
      quickbooks_invoice_link: true,
      customer: { select: { email: true } },
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (user.role === "COMMERCIAL" && invoice.ownerId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (invoice.status === InvoiceStatus.VOID) {
    return NextResponse.json({ error: "Invoice is voided" }, { status: 400 });
  }

  if (!invoice.quickbooks_invoice_id) {
    return NextResponse.json(
      { error: "Invoice is not synced to QuickBooks" },
      { status: 400 }
    );
  }

  if (invoice.quickbooks_invoice_link) {
    return NextResponse.json({ link: invoice.quickbooks_invoice_link, cached: true });
  }

  await quickbooksService.initialize();
  const qbInvoice = await quickbooksService.getInvoice(invoice.quickbooks_invoice_id);
  const link = extractQuickbooksInvoiceLink(qbInvoice);

  if (!link) {
    return NextResponse.json(
      {
        error: "QuickBooks did not return a public invoice link for this invoice",
      },
      { status: 404 }
    );
  }

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { quickbooks_invoice_link: link },
  });

  await prisma.integrationLog.create({
    data: {
      service: "quickbooks",
      action: "invoice_link_copied",
      status: "SUCCESS",
      payload: {
        invoiceId: invoice.id,
        qbInvoiceId: invoice.quickbooks_invoice_id,
        requestedBy: user.id,
        requestedByRole: user.role,
        customerEmail: invoice.customer.email,
      } as any,
    },
  });

  return NextResponse.json({ link });
}
