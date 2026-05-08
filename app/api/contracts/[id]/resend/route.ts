import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  docusignService,
  isContractResendableStatus,
} from "@/lib/services/docusign.service";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let contractId = params.id;
  let envelopeId: string | null = null;

  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (!ALLOWED_ROLES.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        customer: {
          select: {
            email: true,
          },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    if (!contract.docusign_env_id) {
      return NextResponse.json(
        { error: "Contract is not synced to DocuSign" },
        { status: 400 }
      );
    }

    if (!isContractResendableStatus(contract.status)) {
      return NextResponse.json(
        { error: `Contract cannot be resent in status ${contract.status}` },
        { status: 400 }
      );
    }

    envelopeId = contract.docusign_env_id;

    await docusignService.resendEnvelope(envelopeId);

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
      },
    });

    await prisma.integrationLog.create({
      data: {
        service: "DOCUSIGN",
        action: "RESEND_ENVELOPE",
        status: "SUCCESS",
        payload: {
          contractId: contract.id,
          envelopeId,
          recipientEmail: contract.customer?.email || null,
          sentBy: (session.user as any).id,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: "DocuSign notification resent successfully",
    });
  } catch (error) {
    console.error("[CONTRACT_RESEND_ERROR]", error);

    await prisma.integrationLog
      .create({
        data: {
          service: "DOCUSIGN",
          action: "RESEND_ENVELOPE_FAILED",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: {
            contractId,
            envelopeId,
          } as any,
        },
      })
      .catch(() => {});

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to resend DocuSign notification",
      },
      { status: 500 }
    );
  }
}
