import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { identityMapper } from "@/lib/services/identity-mapper";
import { pipedriveService } from "@/lib/services/pipedrive.service";
import { DealStatus, LeadStatus } from "@prisma/client";
import { validatePipedriveWebhookSignature } from "@/lib/utils/webhook-validation";

/**
 * POST /api/webhooks/pipedrive/deal
 *
 * Webhook receiver para Deal Won no Pipedrive
 *
 * Gatilho: Deal move para status "Won"
 *
 * Fluxo:
 * 1. Validar assinatura do webhook
 * 2. Extrair Deal ID e Person ID do payload
 * 3. Buscar dados completos do Deal via Pipedrive API
 * 4. Verificar se existe Lead associado → Converter Lead para CONVERTED
 * 5. Chamar Identity Mapper para reconciliar Customer
 * 6. Criar/Atualizar Deal no banco
 * 7. Disparar processo assíncrono: Gerar Contrato → Criar Fatura → Liberar LMS
 * 8. Logar em IntegrationLog
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
        console.error("[Pipedrive Webhook] Invalid signature");
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 401 }
        );
      }

      console.log("[Pipedrive Webhook] Signature validated successfully");
    } else if (signature && !webhookSecret) {
      console.warn(
        "[Pipedrive Webhook] Webhook secret não configurado, pulando validação"
      );
    }

    // 2. Extrair Deal ID e Person ID do payload
    // Suporta tanto Webhooks v1 quanto v2
    const isV2 = body.meta && body.meta.version === "2.0";
    
    let eventType: string;
    let dealId: number | null = null;
    let personId: number | null = null;
    let dealStatus: string | null = null;

    if (isV2) {
      // Webhooks v2: body.meta.action + body.meta.entity
      const action = body.meta?.action; // "create", "change", "delete"
      const entity = body.meta?.entity; // "deal", "person", etc.
      eventType = `${action}.${entity}`;
      
      if (entity === "deal") {
        dealId = body.data?.id || body.previous?.id;
        personId = body.data?.person_id?.value || body.data?.person_id || body.previous?.person_id?.value || body.previous?.person_id;
        dealStatus = body.data?.status || body.previous?.status;
      }
    } else {
      // Webhooks v1: body.event (legado)
      eventType = body.event;
      dealId = body.current?.id || body.previous?.id;
      personId = body.current?.person_id || body.previous?.person_id;
      dealStatus = body.current?.status;
    }

    if (!dealId) {
      return NextResponse.json(
        { error: "No deal ID found in webhook payload" },
        { status: 400 }
      );
    }

    // Só processar se Deal foi ganho (Won)
    // Suporta tanto v1 (updated.deal) quanto v2 (change.deal)
    const isDealUpdate = eventType === "updated.deal" || eventType === "change.deal";
    if (dealStatus !== "won" && !isDealUpdate) {
      return NextResponse.json({
        success: true,
        message: "Deal not won, skipping",
      });
    }

    // 3. Buscar dados completos do Deal via Pipedrive API
    const dealData = await pipedriveService.getDeal(dealId);
    if (!dealData) {
      return NextResponse.json(
        { error: "Deal not found in Pipedrive" },
        { status: 404 }
      );
    }

    // CONFLICT DETECTION: Check if deal was recently synced from our Hub (prevent webhook loops)
    const existingDeal = await prisma.deal.findUnique({
      where: { pipedrive_deal_id: dealId },
    });

    if (existingDeal?.lastPipedriveSyncAt) {
      const timeSinceSync = Date.now() - existingDeal.lastPipedriveSyncAt.getTime();
      const DEBOUNCE_MS = 5000; // 5 seconds

      if (timeSinceSync < DEBOUNCE_MS) {
        console.log(
          `[Pipedrive Webhook] Deal ${dealId} was synced ${timeSinceSync}ms ago, skipping to prevent loop`
        );
        return NextResponse.json({
          success: true,
          message: "Deal recently synced from Hub, skipping webhook to prevent loop",
        });
      }
    }

    // Verificar se Deal realmente está ganho
    if (dealData.status !== "won") {
      return NextResponse.json({
        success: true,
        message: "Deal not won, skipping",
      });
    }

    // 4. Verificar se existe Lead associado → Converter Lead para CONVERTED
    if (personId) {
      const lead = await prisma.lead.findUnique({
        where: { pipedrive_person_id: personId },
      });

      if (lead && lead.status !== LeadStatus.CONVERTED) {
        // Buscar Deal no banco ou criar
        let deal = await prisma.deal.findUnique({
          where: { pipedrive_deal_id: dealId },
        });

        if (deal) {
          // Atualizar lead com Deal ID
          await prisma.lead.update({
            where: { id: lead.id },
            data: {
              status: LeadStatus.CONVERTED,
              convertedToDealId: deal.id,
              convertedAt: new Date(),
            },
          });
        }
      }
    }

    // 5. Chamar Identity Mapper para reconciliar Customer
    const personData = personId ? await pipedriveService.getPerson(personId) : null;
    const email = personData?.email?.[0]?.value;

    if (email) {
      await identityMapper.reconcileCustomer({
        email,
        name: personData?.name || "Unknown",
        phone: personData?.phone?.[0]?.value,
        externalIds: {
          pipedrive_id: personId || undefined,
        },
        metadata: {
          pipedrive_person_data: personData,
        },
      });
    }

    // 6. Criar/Atualizar Deal no banco
    const customer = email
      ? await prisma.customer.findUnique({ where: { email } })
      : null;

    let deal = await prisma.deal.findUnique({
      where: { pipedrive_deal_id: dealId },
    });

    const dealValue = parseFloat(dealData.value || "0");
    const dealCurrency = dealData.currency || "USD";

    if (deal) {
      // Atualizar Deal existente
      deal = await prisma.deal.update({
        where: { id: deal.id },
        data: {
          title: dealData.title || "Untitled Deal",
          value: dealValue,
          currency: dealCurrency,
          status: DealStatus.WON,
          customerId: customer?.id,
        },
      });
    } else {
      // Criar novo Deal
      const lead = personId
        ? await prisma.lead.findUnique({
            where: { pipedrive_person_id: personId },
          })
        : null;

      deal = await prisma.deal.create({
        data: {
          title: dealData.title || "Untitled Deal",
          value: dealValue,
          currency: dealCurrency,
          status: DealStatus.WON,
          pipedrive_deal_id: dealId,
          customerId: customer?.id,
          convertedFromLeadId: lead?.id,
        },
      });

      // Atualizar Lead se existir
      if (lead) {
        await prisma.lead.update({
          where: { id: lead.id },
          data: {
              status: LeadStatus.CONVERTED,
            convertedToDealId: deal.id,
            convertedAt: new Date(),
          },
        });
      }
    }

    // 7. Disparar processo assíncrono: Gerar Contrato → Criar Fatura → Liberar LMS
    // Não aguardar para não bloquear resposta do webhook
    const { invoiceWorkflowService } = await import("@/lib/services/invoice-workflow.service");
    invoiceWorkflowService.processDealWon(deal.id).catch((error) => {
      console.error(`[Webhook] Error processing invoice workflow for deal ${deal.id}:`, error);
    });

    // 8. Logar em IntegrationLog
    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "WEBHOOK_DEAL_WON",
        status: "SUCCESS",
        payload: {
          eventType,
          dealId,
          personId,
          dealValue,
          dealCurrency,
          dealDbId: deal.id,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      dealId: deal.id,
      message: "Deal processed successfully",
    });
  } catch (error) {
    console.error("Error in Pipedrive deal webhook:", error);

    // Logar erro
    await prisma.integrationLog.create({
      data: {
        service: "PIPEDRIVE",
        action: "WEBHOOK_DEAL_WON",
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
