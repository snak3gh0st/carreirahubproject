import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getEffectiveSyncTimestamps } from "@/lib/integrations/sync-health";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/status
 *
 * Obtém o status geral do sistema e configurações
 */
export async function GET() {
  try {
    const [config, effectiveSyncs] = await Promise.all([
      prisma.systemConfig.findUnique({
        where: { id: "system" },
      }),
      getEffectiveSyncTimestamps(),
    ]);

    const quickbooksAuthStatus = {
      isAuthenticated: config?.quickbooks_is_authenticated || false,
      companyId: config?.quickbooks_company_id || null,
      tokenExpiresAt: config?.quickbooks_token_expires_at?.toISOString() || null,
    };

    const clintStatus = {
      isConfigured: !!process.env.CLINT_API_KEY,
      tokenStatus: process.env.CLINT_API_KEY ? "configured" : "missing",
    };

    return NextResponse.json({
      quickbooks: quickbooksAuthStatus,
      clint: clintStatus,
      secrets: {
        quickbooks: !!config?.quickbooks_webhook_secret,
        clint: !!process.env.CLINT_WEBHOOK_SECRET,
        cron: !!config?.cron_secret,
      },
      lastSync: {
        quickbooks: effectiveSyncs.quickbooksLastSync?.toISOString() || null,
        clint: effectiveSyncs.clintLastSync?.toISOString() || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[System Status] Erro ao obter status:", error);
    return NextResponse.json(
      {
        error: "Erro ao obter status do sistema",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
