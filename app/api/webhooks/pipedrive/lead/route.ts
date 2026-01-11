import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { leadService } from "@/lib/services/lead.service";
import { sdrService } from "@/lib/services/sdr.service";
import { pipedriveService } from "@/lib/services/pipedrive.service";
import { LeadSource } from "@prisma/client";
import { validatePipedriveWebhookSignature } from "@/lib/utils/webhook-validation";

/**
 * POST /api/webhooks/pipedrive/lead
 *
 * Webhook receiver para novos Leads criados no Pipedrive
 *
 * Gatilho: Person criado no Pipedrive (ou Deal criado com status inicial)
 *
 * Fluxo:
 * 1. Validar assinatura do webhook
 * 2. Extrair Person ID do payload
 * 3. Buscar dados completos do Person via Pipedrive API
 * 4. Criar Lead no banco (ou atualizar se já existir)
 * 5. Disparar qualificação automática via SDR Service (assíncrono)
 * 6. Enviar mensagem de boas-vindas via WhatsApp (se tiver telefone)
 * 7. Logar em IntegrationLog
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
        console.error("[Pipedrive Webhook Lead] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }

      console.log("[Pipedrive Webhook Lead] Signature validated successfully");
    } else if (signature && !webhookSecret) {
      console.warn(
        "[Pipedrive Webhook Lead] Webhook secret não configurado, pulando validação"
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
      const entity = body.meta?.entity; // "person", "deal", etc.
      eventType = `${action}.${entity}`;
      
      if (entity === "person") {
        personId = body.data?.id || body.previous?.id;
      } else if (entity === "deal") {
        // Se é um Deal, buscar Person associado
        personId = body.data?.person_id?.value || body.data?.person_id || body.previous?.person_id?.value || body.previous?.person_id;
      }
    } else {
      // Webhooks v1: body.event (legado)
      eventType = body.event;
      
      if (eventType === "added.person") {
        personId = body.current?.id || body.previous?.id;
      } else if (eventType === "updated.person") {
        personId = body.current?.id;
      } else if (eventType === "added.deal" || eventType === "updated.deal") {
        // Se é um Deal, buscar Person associado
        personId = body.current?.person_id || body.previous?.person_id;
      }
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

    // Extrair dados do Person
    const email = personData.email?.[0]?.value || personData.email?.[0]?.value;
    if (!email) {
      return NextResponse.json(
        { error: "Person has no email" },
        { status: 400 }
      );
    }

    const name = personData.name || "Unknown";
    const phone = personData.phone?.[0]?.value || null;

    // 4. Criar Lead no banco (ou atualizar se já existir)
    let lead = await leadService.getLeadByPipedriveId(personId);
    
    if (!lead) {
      // Verificar se já existe por email
      lead = await leadService.getLeadByEmail(email);
      
      if (lead) {
        // Atualizar com Pipedrive ID diretamente usando Prisma
        const { prisma } = await import("@/lib/db");
        lead = await prisma.lead.update({
          where: { id: lead.id },
          data: { pipedrive_person_id: personId },
        });
      } else {
        // Criar novo lead
        lead = await leadService.createLead({
          email,
          name,
          phone: phone || undefined,
          source: LeadSource.WEBSITE, // Pode ser ajustado baseado em metadata
          pipedrive_person_id: personId,
          metadata: {
            pipedrive_person_data: personData,
            webhook_event: eventType,
          },
        });
      }
    } else {
      // Atualizar dados do lead existente
      lead = await leadService.updateLead(lead.id, {
        name,
        phone: phone || undefined,
        metadata: {
          pipedrive_person_data: personData,
          webhook_event: eventType,
        },
      });
    }

    // 5. Disparar qualificação automática via SDR Service (assíncrono)
    // Não aguardar para não bloquear resposta do webhook
    sdrService.processNewLead(lead.id).catch((error) => {
      console.error(`[Webhook] Error processing new lead ${lead.id}:`, error);
    });

    // 6. Enviar mensagem de boas-vindas via WhatsApp (se tiver telefone)
    if (phone) {
      // TODO: Integrar com WhatsApp Service quando disponível
      // await whatsappService.sendWelcomeMessage(phone, name);
      console.log(`[Webhook] Would send welcome message to ${phone}`);
    }

    // 7. Logar em IntegrationLog
    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "WEBHOOK_LEAD_RECEIVED",
        status: "SUCCESS",
        payload: {
          eventType,
          personId,
          leadId: lead.id,
          email,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      message: "Lead processed successfully",
    });
  } catch (error) {
    console.error("Error in Pipedrive lead webhook:", error);

    // Logar erro
    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "WEBHOOK_LEAD_RECEIVED",
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
