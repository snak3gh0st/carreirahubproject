import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";

/**
 * GET /api/quickbooks/payments
 * 
 * Lista payments do QuickBooks
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const maxResults = parseInt(searchParams.get("maxResults") || "100");
    const invoiceId = searchParams.get("invoiceId");

    let payments: any[] = [];

    if (invoiceId) {
      // Buscar payments de uma invoice específica
      payments = await quickbooksService.getPaymentsByInvoice(invoiceId);
    } else {
      // Buscar todos os payments
      payments = await quickbooksService.getAllPayments(maxResults);
    }

    return NextResponse.json({
      count: payments.length,
      payments: payments.map((payment: any) => ({
        id: payment.Id,
        txnDate: payment.TxnDate,
        totalAmt: payment.TotalAmt,
        customerRef: payment.CustomerRef?.value,
        paymentRef: payment.PaymentRefNum,
        paymentMethod: payment.PaymentMethodRef?.value,
        linkedInvoices: payment.Line?.map((line: any) => ({
          invoiceId: line.LinkedTxn?.TxnId,
          amount: line.Amount,
        })) || [],
      })),
    });
  } catch (error: any) {
    console.error("Error fetching QuickBooks payments:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch QuickBooks payments" },
      { status: 500 }
    );
  }
}







