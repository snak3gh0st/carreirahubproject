import { prisma } from "@/lib/db";
import { Lead, LeadStatus, LeadSource, Prisma } from "@prisma/client";
import { aiService, QualificationResult } from "./ai.service";

export interface CreateLeadData {
  email: string;
  name: string;
  phone?: string;
  source?: LeadSource;
  pipedrive_person_id?: number;
  metadata?: any;
}

export interface UpdateLeadData {
  name?: string;
  phone?: string;
  status?: LeadStatus;
  qualificationScore?: number;
  qualificationData?: any;
  metadata?: any;
}

/**
 * Lead Service
 * 
 * Responsabilidade: Gerenciar ciclo de vida do lead desde criação até conversão.
 * Regra: Lead só pode ser convertido em Deal se estiver QUALIFIED.
 */
export class LeadService {
  /**
   * Criar novo lead
   */
  async createLead(data: CreateLeadData): Promise<Lead> {
    return prisma.lead.create({
      data: {
        email: data.email,
        name: data.name,
        phone: data.phone,
        source: data.source || LeadSource.WEBSITE,
        pipedrive_person_id: data.pipedrive_person_id,
        status: LeadStatus.NEW,
        metadata: data.metadata || {},
      },
    });
  }

  /**
   * Buscar lead por ID
   */
  async getLeadById(id: string): Promise<Lead | null> {
    return prisma.lead.findUnique({
      where: { id },
      include: {
        conversations: {
          include: {
            messages: {
              orderBy: { createdAt: "asc" },
            },
          },
        },
        qualifications: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
  }

  /**
   * Buscar lead por email
   */
  async getLeadByEmail(email: string): Promise<Lead | null> {
    return prisma.lead.findUnique({
      where: { email },
    });
  }

  /**
   * Buscar lead por Pipedrive Person ID
   */
  async getLeadByPipedriveId(pipedrivePersonId: number): Promise<Lead | null> {
    return prisma.lead.findUnique({
      where: { pipedrive_person_id: pipedrivePersonId },
    });
  }

  /**
   * Atualizar lead
   */
  async updateLead(id: string, data: UpdateLeadData): Promise<Lead> {
    return prisma.lead.update({
      where: { id },
      data,
    });
  }

  /**
   * Qualificar lead (via AI ou manual)
   */
  async qualifyLead(
    leadId: string,
    qualificationData?: QualificationResult,
    qualifiedById?: string
  ): Promise<Lead> {
    const lead = await this.getLeadById(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    // Se não forneceu dados de qualificação, usar AI
    if (!qualificationData) {
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

      qualificationData = await aiService.qualifyLead({
        name: lead.name,
        email: lead.email,
        phone: lead.phone || undefined,
        source: lead.source,
        conversationHistory,
        metadata: lead.metadata as any,
      });
    }

    // Salvar qualificação no histórico
    await prisma.leadQualification.create({
      data: {
        leadId,
        score: qualificationData.score,
        criteria: qualificationData.criteria as any,
        qualifiedById,
      },
    });

    // Atualizar lead
    const newStatus =
      qualificationData.score >= parseInt(process.env.SDR_QUALIFICATION_THRESHOLD || "70")
        ? LeadStatus.QUALIFIED
        : LeadStatus.QUALIFYING;

    return prisma.lead.update({
      where: { id: leadId },
      data: {
        status: newStatus,
        qualificationScore: qualificationData.score,
        qualificationData: qualificationData as any,
        qualifiedAt: new Date(),
        qualifiedById,
      },
    });
  }

  /**
   * Converter lead em Deal
   */
  async convertToDeal(leadId: string, dealId: string): Promise<Lead> {
    const lead = await this.getLeadById(leadId);
    if (!lead) {
      throw new Error("Lead not found");
    }

    if (lead.status !== LeadStatus.QUALIFIED) {
      throw new Error("Lead must be QUALIFIED before conversion");
    }

    return prisma.lead.update({
      where: { id: leadId },
      data: {
        status: LeadStatus.CONVERTED,
        convertedToDealId: dealId,
        convertedAt: new Date(),
      },
    });
  }

  /**
   * Obter pipeline de leads (agrupado por status)
   */
  async getLeadPipeline(): Promise<Record<LeadStatus, number>> {
    const leads = await prisma.lead.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    });

    const pipeline: Record<LeadStatus, number> = {
      NEW: 0,
      QUALIFYING: 0,
      QUALIFIED: 0,
      UNQUALIFIED: 0,
      CONVERTED: 0,
      LOST: 0,
    };

    leads.forEach((group) => {
      pipeline[group.status] = group._count.id;
    });

    return pipeline;
  }

  /**
   * Listar leads com filtros
   */
  async listLeads(filters?: {
    status?: LeadStatus;
    source?: LeadSource;
    limit?: number;
    offset?: number;
  }): Promise<Lead[]> {
    const where: Prisma.LeadWhereInput = {};

    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.source) {
      where.source = filters.source;
    }

    return prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters?.limit || 50,
      skip: filters?.offset || 0,
    });
  }
}

export const leadService = new LeadService();

