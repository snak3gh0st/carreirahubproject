import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";

export const dynamic = "force-dynamic";

// GET so it can be triggered from browser URL bar while logged in
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const qbCustomerId = request.nextUrl.searchParams.get("id") || "1580";

  await quickbooksService.initialize();

  const query = `SELECT Id, DocNumber, Balance, TotalAmt FROM Invoice WHERE CustomerRef = '${qbCustomerId}' ORDER BY Id DESC MAXRESULTS 100`;
  const result = await (quickbooksService as any).request(
    `/query?query=${encodeURIComponent(query)}`
  );

  const invoices = result.QueryResponse?.Invoice || [];
  const results: string[] = [];

  for (const inv of invoices) {
    try {
      const full = await (quickbooksService as any).request(`/invoice/${inv.Id}`);
      const invoice = full.Invoice;

      await (quickbooksService as any).request(`/invoice?operation=void`, {
        method: "POST",
        body: JSON.stringify({ Id: invoice.Id, SyncToken: invoice.SyncToken }),
      });

      results.push(`Voided ${inv.Id} (${inv.DocNumber}) $${inv.TotalAmt}`);
    } catch (err: any) {
      results.push(`Failed ${inv.Id}: ${err.message}`);
    }
  }

  return NextResponse.json({ total: invoices.length, voided: results.length, results });
}
