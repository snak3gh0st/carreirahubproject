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
 * CORRECT WORKFLOW: Matches Pipedrive persons to existing QuickBooks customers by email
 * QuickBooks is financial source of truth - persons link to QB customers, not create them
 *
 * Gatilho: Person atualizado no Pipedrive
 *
 * Fluxo:
 * 1. Validar assinatura do webhook
 * 2. Extrair Person ID do payload
 * 3. Buscar dados completos do Person via Pipedrive API
 * 4. Check for existing QB customer by email
 *    - If QB customer exists → Link pipedrive_id to customer
 *    - If customer exists without QB → Link pipedrive_id
 *    - If no customer exists → Create Lead (not Customer - no QB sync yet)
 * 5. Debounce check prevents webhook loops (5-second window)
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

    // CRITICAL: Check for existing QuickBooks customer by email FIRST
    // This establishes correct workflow: QB customer exists → link Pipedrive
    // If no QB customer → create Lead (not Customer - no QB sync yet)
    const existingCustomer = await prisma.customer.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        quickbooks_id: true,
        pipedrive_id: true,
        lastPipedriveSyncAt: true,
      },
    });

    // DEBOUNCE: Prevent webhook loops
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

    // CASE 1: Customer exists with QuickBooks ID (QB customer found)
    if (existingCustomer && existingCustomer.quickbooks_id) {
      // Link Pipedrive person to existing QB customer
      await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          pipedrive_id: personId,
          lastPipedriveSyncAt: new Date(),
        },
      });

      await prisma.integrationLog.create({
        data: {
          service: "PIPEDRIVE",
          action: "PERSON_LINKED_TO_QB_CUSTOMER",
          status: "SUCCESS",
          payload: {
            eventType,
            personId,
            customerId: existingCustomer.id,
            quickbooks_id: existingCustomer.quickbooks_id,
            email,
          } as any,
        },
      });

      console.log(
        `[Pipedrive Webhook Person] Linked Pipedrive person ${personId} to existing QB customer ${existingCustomer.id}`
      );

      return NextResponse.json({
        success: true,
        customerId: existingCustomer.id,
        message: "Linked Pipedrive person to existing QB customer",
      });
    }

    // CASE 2: Customer exists WITHOUT QuickBooks ID (manual Hub entry)
    if (existingCustomer && !existingCustomer.quickbooks_id) {
      // Link Pipedrive person to Hub customer
      await prisma.customer.update({
        where: { id: existingCustomer.id },
        data: {
          pipedrive_id: personId,
          lastPipedriveSyncAt: new Date(),
        },
      });

      await prisma.integrationLog.create({
        data: {
          service: "PIPEDRIVE",
          action: "PERSON_LINKED_TO_HUB_CUSTOMER",
          status: "SUCCESS",
          payload: {
            eventType,
            personId,
            customerId: existingCustomer.id,
            email,
          } as any,
        },
      });

      console.log(
        `[Pipedrive Webhook Person] Linked Pipedrive person ${personId} to Hub customer ${existingCustomer.id} (no QB sync)`
      );

      return NextResponse.json({
        success: true,
        customerId: existingCustomer.id,
        message: "Linked Pipedrive person to Hub customer (no QB sync)",
      });
    }

    // CASE 3: No customer exists - Create Lead (NOT Customer)
    // Leads are prospects without QB customer records yet
    const lead = await prisma.lead.create({
      data: {
        email,
        name: personData.name || "Unknown",
        phone: personData.phone?.[0]?.value,
        pipedrive_person_id: personId,
        status: "NEW",
        source: "PIPEDRIVE",
        metadata: {
          pipedrive_person_data: personData,
        } as any,
      },
    });

    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "LEAD_CREATED_FROM_PERSON",
        status: "SUCCESS",
        payload: {
          eventType,
          personId,
          leadId: lead.id,
          email,
        } as any,
      },
    });

    console.log(
      `[Pipedrive Webhook Person] Created Lead ${lead.id} from Pipedrive person ${personId}`
    );

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      message: "Created Lead from Pipedrive person (no QB customer exists)",
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
