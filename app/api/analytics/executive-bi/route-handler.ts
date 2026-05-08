import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { UserRole } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { getExecutiveBIData } from "@/lib/services/executive-bi";
import type { DateRangeParam } from "@/lib/types/financial-bi";

type ExecutiveBISession = {
  user?: {
    id?: string;
    role?: string | null;
  } | null;
} | null;

type ExecutiveBIHandlerDeps = {
  getSession: () => Promise<ExecutiveBISession>;
  getData: typeof getExecutiveBIData;
};

const ALLOWED_ROLES = new Set<string>([UserRole.ADMIN, UserRole.FINANCE]);

export function createExecutiveBIGetHandler(
  deps: ExecutiveBIHandlerDeps = {
    getSession: () => getServerSession(authOptions),
    getData: getExecutiveBIData,
  },
) {
  return async function GET(request: Request) {
    try {
      const session = await deps.getSession();
      const sessionUser = session?.user;

      if (!sessionUser?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      if (!sessionUser.role || !ALLOWED_ROLES.has(sessionUser.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const { searchParams } = new URL(request.url);
      const dateRange = (searchParams.get("dateRange") || "last30") as DateRangeParam;
      const from = searchParams.get("from") || undefined;
      const to = searchParams.get("to") || undefined;

      const data = await deps.getData({ dateRange, from, to });

      return NextResponse.json(data);
    } catch (error) {
      console.error("[EXECUTIVE-BI] Error:", error);
      return NextResponse.json(
        { error: "Failed to fetch executive BI data" },
        { status: 500 },
      );
    }
  };
}
