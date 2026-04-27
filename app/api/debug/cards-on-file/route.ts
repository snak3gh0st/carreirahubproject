import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await quickbooksService.initialize();

  const customers = await prisma.customer.findMany({
    where: { quickbooks_id: { not: null } },
    select: { id: true, name: true, email: true, quickbooks_id: true },
    take: 50,
  });

  const results: any[] = [];

  for (const c of customers) {
    if (!c.quickbooks_id) continue;
    try {
      const method = await quickbooksService.getAutopayMethodFor(c.quickbooks_id);
      if (method) {
        results.push({
          name: c.name,
          email: c.email,
          qbId: c.quickbooks_id,
          card: `${method.type} ••${method.last4}${method.brand ? ` (${method.brand})` : ""}`,
        });
      }
    } catch {
      // skip - no card on file or API error
    }
  }

  return NextResponse.json({
    customersChecked: customers.length,
    withCardOnFile: results.length,
    results,
  });
}
