import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/quickbooks/auth/disconnect
 *
 * Desconecta o QuickBooks limpando os tokens do banco de dados
 */
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Clear QuickBooks tokens from database
    await prisma.systemConfig.upsert({
      where: { id: "system" },
      update: {
        quickbooks_access_token: null,
        quickbooks_refresh_token: null,
        quickbooks_token_expires_at: null,
        quickbooks_company_id: null,
        quickbooks_is_authenticated: false,
        updatedAt: new Date(),
      },
      create: {
        id: "system",
        quickbooks_is_authenticated: false,
      },
    });

    console.log("[QuickBooks Auth] Disconnected - tokens cleared from database");

    return NextResponse.json({
      success: true,
      message: "QuickBooks disconnected successfully",
    });
  } catch (error) {
    console.error("[QuickBooks Auth] Error disconnecting:", error);
    return NextResponse.json(
      {
        error: "Failed to disconnect QuickBooks",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
