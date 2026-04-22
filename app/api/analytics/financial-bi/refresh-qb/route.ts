import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { refreshQbCfoReports } from "@/lib/services/qb-cfo-reports";

// POST /api/analytics/financial-bi/refresh-qb
// Manually re-fetches all QB CFO reports (P&L, Balance Sheet, etc.) and updates the cache.
// Requires admin session. Use this after changing the report date range.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "FINANCE"].includes((session.user as any)?.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await refreshQbCfoReports();
    return NextResponse.json({ success: true, refreshedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("[REFRESH-QB] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to refresh QB reports" }, { status: 500 });
  }
}
