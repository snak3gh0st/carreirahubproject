import { prisma } from "@/lib/db";
import { Customer } from "@prisma/client";

export interface ExternalIds {
  pipedrive_id?: number;
  quickbooks_id?: string;
  stripe_id?: string;
  trello_id?: string;
  cloudtalk_id?: string;
  google_contact_id?: string;
}

export interface CustomerData {
  email: string;
  name: string;
  phone?: string;
  document?: string;
  externalIds?: ExternalIds;
  metadata?: any;
}

/**
 * Identity Mapper Service
 * 
 * Responsabilidade: Reconciliar duplicidades de e-mail entre CRM e Financeiro.
 * Regra crítica: Nunca criar duplicatas. Email é chave única.
 */
export class IdentityMapperService {
  /**
   * Reconciliar ou criar Customer baseado em email e IDs externos
   */
  async reconcileCustomer(data: CustomerData): Promise<Customer> {
    const { email, name, phone, document, externalIds = {}, metadata } = data;

    // Buscar Customer existente por email
    let customer = await prisma.customer.findUnique({
      where: { email },
    });

    if (customer) {
      // Customer existe: atualizar IDs externos faltantes
      const updates: Partial<Customer> = {};

      // Atualizar campos básicos se necessário
      if (name && !customer.name) updates.name = name;
      if (phone && !customer.phone) updates.phone = phone;
      if (document && !customer.document) updates.document = document;

      // Atualizar IDs externos que não existem
      if (externalIds.pipedrive_id && !customer.pipedrive_id) {
        updates.pipedrive_id = externalIds.pipedrive_id;
      }
      if (externalIds.quickbooks_id && !customer.quickbooks_id) {
        updates.quickbooks_id = externalIds.quickbooks_id;
      }
      if (externalIds.stripe_id && !customer.stripe_id) {
        updates.stripe_id = externalIds.stripe_id;
      }
      if (externalIds.trello_id && !customer.trello_id) {
        updates.trello_id = externalIds.trello_id;
      }
      if (externalIds.cloudtalk_id && !customer.cloudtalk_id) {
        updates.cloudtalk_id = externalIds.cloudtalk_id;
      }
      if (externalIds.google_contact_id && !customer.google_contact_id) {
        updates.google_contact_id = externalIds.google_contact_id;
      }

      // Merge metadata
      if (metadata) {
        const currentMetadata = (customer.metadata as any) || {};
        updates.metadata = { ...currentMetadata, ...metadata } as any;
      }

      // Atualizar apenas se houver mudanças
      if (Object.keys(updates).length > 0) {
        customer = await prisma.customer.update({
          where: { id: customer.id },
          data: updates as any,
        });
      }
    } else {
      // Customer não existe: criar novo
      customer = await prisma.customer.create({
        data: {
          email,
          name,
          phone,
          document,
          pipedrive_id: externalIds.pipedrive_id,
          quickbooks_id: externalIds.quickbooks_id,
          stripe_id: externalIds.stripe_id,
          trello_id: externalIds.trello_id,
          cloudtalk_id: externalIds.cloudtalk_id,
          google_contact_id: externalIds.google_contact_id,
          metadata: metadata || {},
        },
      });
    }

    return customer;
  }

  /**
   * Buscar Customer por ID externo
   */
  async findByExternalId(
    service: "pipedrive" | "quickbooks" | "stripe" | "trello" | "cloudtalk" | "google_contact",
    externalId: string | number
  ): Promise<Customer | null> {
    const where: any = {};

    switch (service) {
      case "pipedrive":
        where.pipedrive_id = Number(externalId);
        break;
      case "quickbooks":
        where.quickbooks_id = String(externalId);
        break;
      case "stripe":
        where.stripe_id = String(externalId);
        break;
      case "trello":
        where.trello_id = String(externalId);
        break;
      case "cloudtalk":
        where.cloudtalk_id = String(externalId);
        break;
      case "google_contact":
        where.google_contact_id = String(externalId);
        break;
    }

    return prisma.customer.findFirst({ where });
  }

  /**
   * Adicionar ID externo a Customer existente
   */
  async addExternalId(
    customerId: string,
    service: "pipedrive" | "quickbooks" | "stripe" | "trello" | "cloudtalk" | "google_contact",
    externalId: string | number
  ): Promise<Customer> {
    const updates: any = {};

    switch (service) {
      case "pipedrive":
        updates.pipedrive_id = Number(externalId);
        break;
      case "quickbooks":
        updates.quickbooks_id = String(externalId);
        break;
      case "stripe":
        updates.stripe_id = String(externalId);
        break;
      case "trello":
        updates.trello_id = String(externalId);
        break;
      case "cloudtalk":
        updates.cloudtalk_id = String(externalId);
        break;
      case "google_contact":
        updates.google_contact_id = String(externalId);
        break;
    }

    return prisma.customer.update({
      where: { id: customerId },
      data: updates,
    });
  }
}

export const identityMapper = new IdentityMapperService();

