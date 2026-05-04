import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/system/status
 *
 * Obtém o status geral do sistema e configurações
 */
export async function GET(request: NextRequest) {
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    const pipedriveApiToken = process.env.PIPEDRIVE_API_TOKEN;
    const pipedriveCompanyDomain = process.env.PIPEDRIVE_COMPANY_DOMAIN;

    const quickbooksAuthStatus = {
      isAuthenticated: config?.quickbooks_is_authenticated || false,
      companyId: config?.quickbooks_company_id || null,
      tokenExpiresAt: config?.quickbooks_token_expires_at?.toISOString() || null,
    };

    const pipedriveStatus = {
      isConfigured: !!pipedriveApiToken && !!pipedriveCompanyDomain,
      companyDomain: pipedriveCompanyDomain || null,
      tokenStatus: pipedriveApiToken ? 'unchecked' : 'invalid',
    };

    return NextResponse.json({
      quickbooks: quickbooksAuthStatus,
      // pipedrive removed
      secrets: {
        quickbooks: !!config?.quickbooks_webhook_secret,
        // pipedrive removed
        cron: !!config?.cron_secret,
      },
      lastSync: {
        quickbooks: config?.last_qb_sync?.toISOString() || null,
        // pipedrive removed
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
