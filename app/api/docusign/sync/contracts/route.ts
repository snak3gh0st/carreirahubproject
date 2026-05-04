import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { docusignContractSyncService } from "@/lib/services/docusign-contract-sync.service";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as any).role;
  if (!["ADMIN", "FINANCE"].includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const contractId = typeof body?.contractId === "string" ? body.contractId : null;
  const fromDate = typeof body?.fromDate === "string" ? new Date(body.fromDate) : undefined;
  const maxPages = typeof body?.maxPages === "number" ? body.maxPages : undefined;
  const pageSize = typeof body?.pageSize === "number" ? body.pageSize : undefined;

  try {
    if (contractId) {
      const result = await docusignContractSyncService.syncContract(contractId);
      return NextResponse.json({ mode: "single", result });
    }

    const result = await docusignContractSyncService.syncAllContracts({
      fromDate,
      maxPages,
      pageSize,
    });
    return NextResponse.json({ mode: "batch", result });
  } catch (error) {
    console.error("[API_DOCUSIGN_SYNC_CONTRACTS]", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Sync failed",
      },
      { status: 500 }
    );
  }
}
