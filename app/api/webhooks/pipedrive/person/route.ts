import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { pipedriveService } from "@/lib/services/pipedrive.service";
import { identityMapper } from "@/lib/services/identity-mapper";
import { validatePipedriveWebhookSignature } from "@/lib/utils/webhook-validation";

/**
 * POST /api/webhooks/pipedrive/person
 *
 * Webhook receiver para Person updates no Pipedrive
 *
 * Gatilho: Person atualizado no Pipedrive
 *
 * Fluxo:
 * 1. Validar assinatura do webhook
 * 2. Extrair Person ID do payload
 * 3. Check for conflict (recently synced from Hub)
 * 4. Buscar dados completos do Person via Pipedrive API
 * 5. Usar Identity Mapper para reconciliar Customer
 * 6. Logar em IntegrationLog
 */
export async function POST(request: NextRequest) {
  let rawBody = "";
  let body: any = {};

  try {
    rawBody = await request.text();
    body = rawBody ? JSON.parse(rawBody) : {};
    const signature = request.headers.get("x-pipedrive-signature");

    // Obter secret do banco de dados
    const config = await prisma.systemConfig.findUnique({
      where: { id: "system" },
    });

    const webhookSecret =
      config?.pipedrive_webhook_secret ||
      process.env.PIPEDRIVE_WEBHOOK_SECRET;

    // 1. Validar assinatura do webhook (se configurado)
    if (webhookSecret && signature) {
      const isValid = validatePipedriveWebhookSignature(
        rawBody,
        signature,
        webhookSecret
      );

      if (!isValid) {
        console.error("[Pipedrive Webhook Person] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }

      console.log("[Pipedrive Webhook Person] Signature validated successfully");
    } else if (signature && !webhookSecret) {
      console.warn(
        "[Pipedrive Webhook Person] Webhook secret não configurado, pulando validação"
      );
    }

    // 2. Extrair Person ID do payload
    // Suporta tanto Webhooks v1 quanto v2
    const isV2 = body.meta && body.meta.version === "2.0";

    let eventType: string;
    let personId: number | null = null;

    if (isV2) {
      // Webhooks v2: body.meta.action + body.meta.entity
      const action = body.meta?.action; // "create", "change", "delete"
      const entity = body.meta?.entity; // "person"
      eventType = `${action}.${entity}`;

      if (entity === "person") {
        personId = body.data?.id || body.previous?.id;
      }
    } else {
      // Webhooks v1: body.event (legado)
      eventType = body.event;
      personId = body.current?.id || body.previous?.id;
    }

    if (!personId) {
      return NextResponse.json(
        { error: "No person ID found in webhook payload" },
        { status: 400 }
      );
    }

    // 3. Buscar dados completos do Person via Pipedrive API
    const personData = await pipedriveService.getPerson(personId);
    if (!personData) {
      return NextResponse.json(
        { error: "Person not found in Pipedrive" },
        { status: 404 }
      );
    }

    // Extrair email
    const email = personData.email?.[0]?.value;
    if (!email) {
      return NextResponse.json(
        { error: "Person has no email" },
        { status: 400 }
      );
    }

    // CONFLICT DETECTION: Check if customer was recently synced from our Hub (prevent webhook loops)
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
    });

    if (existingCustomer?.lastPipedriveSyncAt) {
      const timeSinceSync = Date.now() - existingCustomer.lastPipedriveSyncAt.getTime();
      const DEBOUNCE_MS = 5000; // 5 seconds

      if (timeSinceSync < DEBOUNCE_MS) {
        console.log(
          `[Pipedrive Webhook Person] Customer ${email} was synced ${timeSinceSync}ms ago, skipping to prevent loop`
        );
        return NextResponse.json({
          success: true,
          message: "Customer recently synced from Hub, skipping webhook to prevent loop",
        });
      }
    }

    // 4. Usar Identity Mapper para reconciliar Customer
    const customer = await identityMapper.reconcileCustomer({
      email,
      name: personData.name || "Unknown",
      phone: personData.phone?.[0]?.value,
      externalIds: {
        pipedrive_id: personId,
      },
      metadata: {
        pipedrive_person_data: personData,
      },
    });

    // 5. Logar em IntegrationLog
    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "WEBHOOK_PERSON_UPDATED",
        status: "SUCCESS",
        payload: {
          eventType,
          personId,
          customerId: customer.id,
          email,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      customerId: customer.id,
      message: "Person processed successfully",
    });
  } catch (error) {
    console.error("Error in Pipedrive person webhook:", error);

    // Logar erro
    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "WEBHOOK_PERSON_UPDATED",
        status: "ERROR",
        error: error instanceof Error ? error.message : "Unknown error",
        payload: body as any,
      },
    }).catch(() => {});

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
