import { NextRequest, NextResponse } from "next/server";
import { quickbooksSyncService } from "@/lib/services/quickbooks-sync.service";

/**
 * GET/POST /api/cron/quickbooks-sync
 * 
 * Cron job para sincronização automática do QuickBooks
 * 
 * Configuração no Vercel (vercel.json):
 * - path: /api/cron/quickbooks-sync
 * - schedule: 0 a cada 6 horas (formato cron: 0 0,6,12,18 * * *)
 * 
 * Ou usar variável de ambiente CRON_SECRET para segurança
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return handleSync(request);
}

export async function POST(request: NextRequest) {
  return handleSync(request);
}

async function handleSync(request: NextRequest) {
  try {
    // Verificar CRON_SECRET se configurado (recomendado para produção)
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 }
        );
      }
    }

    // Obter opções do body ou usar padrões
    const body = await request.json().catch(() => ({}));
    const options = {
      syncCustomers: body.syncCustomers !== false, // Padrão: true
      syncInvoices: body.syncInvoices !== false, // Padrão: true
      syncPayments: body.syncPayments !== false, // Padrão: true
      syncItems: body.syncItems || false,
      maxResults: body.maxResults || 1000,
      incremental: body.incremental !== false, // Padrão: true (sincronização incremental)
    };

    console.log("[QuickBooks Cron] Starting automatic sync...", options);

    // Executar sincronização
    const result = await quickbooksSyncService.sync(options);

    console.log("[QuickBooks Cron] Sync completed:", {
      success: result.success,
      duration: result.duration,
      customers: result.customers,
      invoices: result.invoices,
    });

    return NextResponse.json({
      success: true,
      message: "QuickBooks sync completed",
      result: {
        success: result.success,
        duration: result.duration,
        customers: result.customers,
        invoices: result.invoices,
        payments: result.payments,
        items: result.items,
        startTime: result.startTime,
        endTime: result.endTime,
      },
    });
  } catch (error: any) {
    console.error("[QuickBooks Cron] Error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to sync QuickBooks",
      },
      { status: 500 }
    );
  }
}

