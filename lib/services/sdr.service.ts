import { prisma } from "@/lib/db";
import { LeadStatus } from "@prisma/client";
import { leadService } from "./lead.service";
import { aiService } from "./ai.service";

const QUALIFICATION_THRESHOLD = parseInt(process.env.SDR_QUALIFICATION_THRESHOLD || "70");

/**
 * SDR Service
 * 
 * Responsabilidade: Orquestrar processo de qualificação automática de leads.
 */
export class SDRService {
  /**
   * Qualificação automática de lead
   * Fluxo: Buscar dados → Qualificar via AI → Atualizar status → Enviar mensagem (se qualificado)
   */
  async autoQualifyLead(leadId: string): Promise<{
    qualified: boolean;
    score: number;
    status: LeadStatus;
  }> {
    const lead = await leadService.getLeadById(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // Buscar histórico de conversas
    const conversations = await prisma.conversation.findMany({
      where: { leadId },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const conversationHistory = conversations.flatMap((conv) =>
      conv.messages.map((msg) => ({
        role: msg.role.toLowerCase() as "user" | "assistant",
        content: msg.content,
      }))
    );

    // Qualificar via AI
    const qualificationResult = await aiService.qualifyLead({
      name: lead.name,
      email: lead.email,
      phone: lead.phone || undefined,
      source: lead.source,
      conversationHistory,
      metadata: lead.metadata as any,
    });

    // Atualizar lead com qualificação
    await leadService.qualifyLead(leadId, qualificationResult);

    const qualified = qualificationResult.score >= QUALIFICATION_THRESHOLD;
    const newStatus = qualified ? LeadStatus.QUALIFIED : LeadStatus.QUALIFYING;

    // Se qualificado, enviar mensagem automática
    if (qualified && lead.phone) {
      await this.sendQualificationMessage(leadId);
    }

    return {
      qualified,
      score: qualificationResult.score,
      status: newStatus,
    };
  }

  /**
   * Atribuir lead para SDR humano
   */
  async assignToSDR(leadId: string, sdrUserId: string): Promise<void> {
    const lead = await leadService.getLeadById(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // Atualizar lead com SDR atribuído
    await prisma.lead.update({
      where: { id: leadId },
      data: {
        qualifiedById: sdrUserId,
        status: LeadStatus.QUALIFYING,
      },
    });
  }

  /**
   * Enviar mensagem automática de qualificação via WhatsApp
   */
  async sendQualificationMessage(leadId: string): Promise<void> {
    const lead = await leadService.getLeadById(leadId);
    if (!lead || !lead.phone) {
      return; // Não tem telefone, não envia
    }

    const { whatsappService } = await import("./whatsapp.service");
    await whatsappService.sendQualificationMessage(lead.phone, lead.name);
  }

  /**
   * Processar lead recém-criado (workflow completo)
   */
  async processNewLead(leadId: string): Promise<void> {
    try {
      // 1. Qualificar automaticamente
      const qualification = await this.autoQualifyLead(leadId);

      // 2. Se não qualificado, atribuir para SDR humano (round-robin ou fila)
      if (!qualification.qualified) {
        // TODO: Implementar lógica de atribuição (round-robin, fila, etc.)
        console.log(`[SDR] Lead ${leadId} não qualificado automaticamente. Score: ${qualification.score}`);
      }

      // 3. Logar resultado
      await prisma.integrationLog.create({
        data: {
          service: "SDR_SERVICE",
          action: "LEAD_QUALIFIED",
          status: qualification.qualified ? "SUCCESS" : "PARTIAL",
          payload: {
            leadId,
            score: qualification.score,
            qualified: qualification.qualified,
          } as any,
        },
      });
    } catch (error) {
      console.error(`[SDR] Error processing lead ${leadId}:`, error);
      
      // Logar erro
      await prisma.integrationLog.create({
        data: {
          service: "SDR_SERVICE",
          action: "LEAD_QUALIFIED",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: { leadId } as any,
        },
      });
    }
  }
}

export const sdrService = new SDRService();

