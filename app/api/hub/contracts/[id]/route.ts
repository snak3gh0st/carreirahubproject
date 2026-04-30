import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/contracts/[id]?action=view|download
 * Returns a redirect to the signed contract PDF.
 * Auth-gated: only the contract owner can access it.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getHubAuth(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contract = await prisma.contract.findFirst({
    where: { id: params.id, customerId: auth.customerId },
    select: {
      id: true,
      signedS3Url: true,
      signedS3UrlExpiresAt: true,
      docusign_env_id: true,
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const urlValid =
    contract.signedS3Url &&
    (!contract.signedS3UrlExpiresAt ||
      new Date(contract.signedS3UrlExpiresAt) > new Date());

  if (!urlValid) {
    return NextResponse.json(
      { error: "Contract PDF not available. Please contact support." },
      { status: 404 }
    );
  }

  const action = request.nextUrl.searchParams.get("action");
  const headers: Record<string, string> = {};

  if (action === "download") {
    headers["Content-Disposition"] = `attachment; filename="contrato-${contract.id.slice(0, 8)}.pdf"`;
  }

  return NextResponse.redirect(contract.signedS3Url!, { headers });
}
