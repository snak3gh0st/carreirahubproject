import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFinancialBIData } from "@/lib/services/financial-bi";
import { DateRangeParam, TabParam } from "@/lib/types/financial-bi";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const tab = (searchParams.get("tab") || "all") as TabParam;

    const data = await getFinancialBIData(dateRange, from, to, tab);

    return NextResponse.json(data);
  } catch (error) {
    console.error("[FINANCIAL-BI] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch financial BI data" },
      { status: 500 },
    );
  }
}
