import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getCommercialBIData } from "@/lib/services/commercial-bi";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set(["ADMIN", "HEAD_COMERCIAL"]);

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = String((session.user as any)?.role ?? "");
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const dateRange = searchParams.get("dateRange") || "last30";
  const from = searchParams.get("from") || undefined;
  const to = searchParams.get("to") || undefined;

  try {
    const data = await getCommercialBIData({ preset: dateRange, from, to });
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Commercial BI] Failed to load data:", error);
    return NextResponse.json(
      { error: "Failed to load commercial BI" },
      { status: 500 }
    );
  }
}
