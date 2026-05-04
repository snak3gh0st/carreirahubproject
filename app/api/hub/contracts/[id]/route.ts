import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { documentStorageService } from "@/lib/services/document-storage.service";

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
      status: true,
      signedS3Key: true,
      signedS3Url: true,
      signedS3UrlExpiresAt: true,
      signedUrl: true,
      docusign_env_id: true,
    },
  });

  if (!contract) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (contract.status !== "SIGNED") {
    return NextResponse.json(
      { error: "Contract is not signed yet" },
      { status: 400 }
    );
  }

  const action = request.nextUrl.searchParams.get("action");
  const headers: Record<string, string> = {};

  if (action === "download") {
    headers["Content-Disposition"] = `attachment; filename="contrato-${contract.id.slice(0, 8)}.pdf"`;
  }

  if (contract.signedS3Key && documentStorageService.isConfigured()) {
    const now = new Date();
    const s3UrlValid =
      contract.signedS3Url &&
      contract.signedS3UrlExpiresAt &&
      contract.signedS3UrlExpiresAt > now;

    let downloadUrl = contract.signedS3Url;

    if (!s3UrlValid) {
      downloadUrl = await documentStorageService.getPresignedUrl(contract.signedS3Key);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await prisma.contract.update({
        where: { id: contract.id },
        data: {
          signedS3Url: downloadUrl,
          signedS3UrlExpiresAt: expiresAt,
        },
      });
    }

    return NextResponse.redirect(downloadUrl!, { headers });
  }

  if (contract.docusign_env_id) {
    try {
      const { docusignService } = await import("@/lib/services/docusign.service");
      const pdfBuffer = await docusignService.downloadDocument(contract.docusign_env_id, "combined");

      if (documentStorageService.isConfigured()) {
        const s3Key = await documentStorageService.uploadSignedContract(
          contract.docusign_env_id,
          pdfBuffer,
          { contractId: contract.id, customerId: auth.customerId }
        );
        const downloadUrl = await documentStorageService.getPresignedUrl(s3Key);
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.contract.update({
          where: { id: contract.id },
          data: {
            signedS3Key: s3Key,
            signedS3Url: downloadUrl,
            signedS3UrlExpiresAt: expiresAt,
          },
        });

        return NextResponse.redirect(downloadUrl, { headers });
      }

      const responseHeaders = new Headers({
        "Content-Type": "application/pdf",
        "Content-Disposition":
          action === "download"
            ? `attachment; filename="contrato-${contract.id.slice(0, 8)}.pdf"`
            : `inline; filename="contrato-${contract.id.slice(0, 8)}.pdf"`,
      });

      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("[API_HUB_CONTRACT] Failed to fetch DocuSign PDF:", error);
    }
  }

  if (contract.signedUrl) {
    return NextResponse.json(
      { error: "Contract PDF requires regeneration. Please try again shortly." },
      { status: 409 }
    );
  }

  return NextResponse.json(
    { error: "Contract PDF not available. Please contact support." },
    { status: 404 }
  );
}
