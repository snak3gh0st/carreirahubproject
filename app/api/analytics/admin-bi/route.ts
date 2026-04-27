import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminBIData, AdminBITab } from "@/lib/services/admin-bi";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as any)?.role;
  if (!["ADMIN", "FINANCE"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const preset = searchParams.get("dateRange") || "last90";
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const tab = (searchParams.get("tab") || "all") as AdminBITab;

    const data = await getAdminBIData(preset, from, to, tab);
    return NextResponse.json(data);
  } catch (error) {
    console.error("[admin-bi] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch BI data", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
