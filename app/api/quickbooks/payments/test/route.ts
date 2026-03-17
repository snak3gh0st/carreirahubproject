import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";

export const dynamic = "force-dynamic";

/**
 * GET /api/quickbooks/payments/test?customerId={qbCustomerId}
 *
 * Test endpoint to validate QB Payments API connectivity and list
 * payment methods on file for a given customer.
 * Admin-only access.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if ((session.user as any).role !== "ADMIN") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get("customerId");

    if (!customerId) {
      return NextResponse.json(
        { error: "customerId query parameter is required (QuickBooks customer ID)" },
        { status: 400 }
      );
    }

    await quickbooksService.initialize();

    let paymentMethods;
    try {
      paymentMethods = await quickbooksService.getCustomerPaymentMethods(customerId);
    } catch (error: any) {
      return NextResponse.json({
        connected: false,
        paymentsApiReachable: false,
        error: error.message,
        hint: "Ensure QuickBooks Payments is enabled on your QB account and OAuth tokens are valid.",
      }, { status: 502 });
    }

    return NextResponse.json({
      connected: true,
      paymentsApiReachable: true,
      customer: { qbId: customerId },
      paymentMethods: {
        cards: paymentMethods.cards.map((c: any) => ({
          id: c.id,
          last4: c.number?.slice(-4),
          brand: c.cardType || c.type,
          expMonth: c.expMonth,
          expYear: c.expYear,
        })),
        bankAccounts: paymentMethods.bankAccounts.map((ba: any) => ({
          id: ba.id,
          last4: ba.accountNumber?.slice(-4),
          bankName: ba.bankName || ba.name,
        })),
      },
      hasPaymentMethod: paymentMethods.hasPaymentMethod,
    });
  } catch (error: any) {
    console.error("[QB Payments Test] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
