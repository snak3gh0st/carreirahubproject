import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes } from "crypto";

/**
 * POST /api/system/secrets/generate
 *
 * Gera secrets seguros para webhooks e cron jobs
 * REQUER autenticação de admin (implementar conforme necessário)
 */
export async function POST(request: NextRequest) {
  try {
    // TODO: Implementar validação de autenticação de admin
    // Por enquanto, apenas bloquear em produção sem autorização apropriada

    const authorization = request.headers.get("authorization");
    const expectedAuth = process.env.CRON_SECRET || "not-set";

    // Validação simples (não é segura para produção)
    if (
      process.env.NODE_ENV === "production" &&
      authorization !== `Bearer ${expectedAuth}`
    ) {
      return NextResponse.json(
        { error: "Não autorizado" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { generateNew } = body as {
      generateNew?: boolean;
    };

    console.log("[System] Gerando/atualizando webhook secrets");

    // Obter configuração existente
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    // Gerar novos secrets se solicitado ou se não existirem
    const quickbooksSecret = generateNew
      ? randomBytes(32).toString("hex")
      : config?.quickbooks_webhook_secret || randomBytes(32).toString("hex");

    const pipedriveSecret = generateNew
      ? randomBytes(32).toString("hex")
      : config?.pipedrive_webhook_secret || randomBytes(32).toString("hex");

    const cronSecret = generateNew
      ? randomBytes(32).toString("hex")
      : config?.cron_secret || randomBytes(32).toString("hex");

    // Salvar no banco
    await prisma.systemConfig.upsert({
      where: { id: "system" },
      update: {
        quickbooks_webhook_secret: quickbooksSecret,
        pipedrive_webhook_secret: pipedriveSecret,
        cron_secret: cronSecret,
        updatedAt: new Date(),
      },
      create: {
        id: "system",
        quickbooks_webhook_secret: quickbooksSecret,
        pipedrive_webhook_secret: pipedriveSecret,
        cron_secret: cronSecret,
      },
    });

    console.log("[System] Secrets atualizados no banco de dados");

    return NextResponse.json({
      message: "Secrets gerados com sucesso",
      secrets: {
        quickbooksWebhookSecret: quickbooksSecret,
        pipedriveWebhookSecret: pipedriveSecret,
        cronSecret: cronSecret,
      },
      instructions: {
        quickbooks:
          "Adicione este secret no Intuit Developer Portal > webhooks > Webhook Verification Token",
        pipedrive:
          "Salve este secret no Pipedrive para validar assinaturas de webhook (se necessário)",
        cron: "Use este secret no header Authorization: Bearer <secret> para chamar endpoints de cron",
      },
      generated: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[System] Erro ao gerar secrets:", error);
    return NextResponse.json(
      {
        error: "Erro ao gerar secrets",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/system/secrets/generate
 *
 * Obtém o status dos secrets (sem expor os valores)
 */
export async function GET(request: NextRequest) {

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    return NextResponse.json({
      secretsConfigured: {
        quickbooks: !!config?.quickbooks_webhook_secret,
        pipedrive: !!config?.pipedrive_webhook_secret,
        cron: !!config?.cron_secret,
      },
      message: "Todos os secrets estão configurados",
      lastUpdated: config?.updatedAt,
    });
  } catch (error) {
    console.error("[System] Erro ao verificar secrets:", error);
    return NextResponse.json(
      {
        error: "Erro ao verificar status de secrets",
      },
      { status: 500 }
    );
  }
}
