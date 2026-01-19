import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/quickbooks/payment-terms
 * Fetch all active QuickBooks Payment Terms from database (synced data)
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const paymentTerms = await prisma.quickBooksPaymentTerm.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        qbId: true,
        name: true,
        dueDays: true,
        discountDays: true,
        discountPercent: true,
        active: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(paymentTerms);
  } catch (error: any) {
    console.error("Error fetching QuickBooks payment terms:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch QuickBooks payment terms" },
      { status: 500 }
    );
  }
}
