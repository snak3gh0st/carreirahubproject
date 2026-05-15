import { prisma } from "@/lib/db";
import { Customer } from "@prisma/client";

export interface ExternalIds {
  clint_contact_id?: string;
  quickbooks_id?: string;
  docusign_id?: string;
  trello_id?: string;
  cloudtalk_id?: string;
  google_contact_id?: string;
}

export interface CustomerData {
  email: string;
  name: string;
  phone?: string;
  dateOfBirth?: Date;
  ssn?: string;
  passport?: string;
  cpf?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  externalIds?: ExternalIds;
  metadata?: any;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}

/**
 * Identity Mapper Service
 * 
 * Responsabilidade: Reconciliar duplicidades de e-mail entre CRM e Financeiro.
 * Regra crítica: Nunca criar duplicatas. Email é chave única.
 */
export class IdentityMapperService {
  private async findByAnyExternalId(externalIds: ExternalIds): Promise<Customer | null> {
    const externalWhere = [
      externalIds.clint_contact_id ? { clint_contact_id: externalIds.clint_contact_id } : null,
      externalIds.quickbooks_id ? { quickbooks_id: externalIds.quickbooks_id } : null,
      externalIds.docusign_id ? { docusign_id: externalIds.docusign_id } : null,
      externalIds.trello_id ? { trello_id: externalIds.trello_id } : null,
      externalIds.cloudtalk_id ? { cloudtalk_id: externalIds.cloudtalk_id } : null,
      externalIds.google_contact_id ? { google_contact_id: externalIds.google_contact_id } : null,
    ].filter(Boolean);

    if (externalWhere.length === 0) {
      return null;
    }

    return prisma.customer.findFirst({
      where: { OR: externalWhere as any },
    });
  }

  /**
   * Reconciliar ou criar Customer baseado em email e IDs externos
   */
  async reconcileCustomer(data: CustomerData): Promise<Customer> {
    const { email, name, phone, dateOfBirth, ssn, passport, cpf, address, city, state, zipCode, country, externalIds = {}, metadata } = data;
    const syncDate = new Date();

    // External provider IDs are more stable than email. Clint/QuickBooks may
    // change or omit email, so look up provider IDs first to avoid duplicate
    // records and unique constraint failures.
    let customer = await this.findByAnyExternalId(externalIds);

    if (!customer) {
      customer = await prisma.customer.findUnique({
        where: { email },
      });
    }

    const updateExistingCustomer = async (existingCustomer: Customer): Promise<Customer> => {
      // Customer existe: atualizar IDs externos e fill empty fields.
      // Name and phone are always updated when provided (allows corrections).
      // Other PII fields (ssn, passport, etc.) only fill empty to avoid
      // overwriting manually-entered data.
      const updates: Partial<Customer> = {};

      // Always update name and phone when provided (allows fixing incorrect data)
      if (name && name !== existingCustomer.name) updates.name = name;
      if (phone && phone !== existingCustomer.phone) updates.phone = phone;

      // PII and address fields: only fill if currently empty
      if (dateOfBirth && !existingCustomer.dateOfBirth) updates.dateOfBirth = dateOfBirth;
      if (ssn && !existingCustomer.ssn) updates.ssn = ssn;
      if (passport && !existingCustomer.passport) updates.passport = passport;
      if (cpf && !existingCustomer.cpf) updates.cpf = cpf;
      if (address && !existingCustomer.address) updates.address = address;
      if (city && !existingCustomer.city) updates.city = city;
      if (state && !existingCustomer.state) updates.state = state;
      if (zipCode && !existingCustomer.zipCode) updates.zipCode = zipCode;
      if (country && !existingCustomer.country) updates.country = country;

      // Atualizar IDs externos que não existem
      if (externalIds.clint_contact_id && !existingCustomer.clint_contact_id) {
        updates.clint_contact_id = externalIds.clint_contact_id;
      }
      if (externalIds.clint_contact_id) {
        updates.lastClintSyncAt = syncDate;
      }
      if (externalIds.quickbooks_id && !existingCustomer.quickbooks_id) {
        updates.quickbooks_id = externalIds.quickbooks_id;
      }
      if (externalIds.docusign_id && !existingCustomer.docusign_id) {
        updates.docusign_id = externalIds.docusign_id;
      }
      if (externalIds.trello_id && !existingCustomer.trello_id) {
        updates.trello_id = externalIds.trello_id;
      }
      if (externalIds.cloudtalk_id && !existingCustomer.cloudtalk_id) {
        updates.cloudtalk_id = externalIds.cloudtalk_id;
      }
      if (externalIds.google_contact_id && !existingCustomer.google_contact_id) {
        updates.google_contact_id = externalIds.google_contact_id;
      }

      // Merge metadata
      if (metadata) {
        const currentMetadata = (existingCustomer.metadata as any) || {};
        updates.metadata = { ...currentMetadata, ...metadata } as any;
      }

      // Atualizar apenas se houver mudanças
      if (Object.keys(updates).length > 0) {
        return prisma.customer.update({
          where: { id: existingCustomer.id },
          data: updates as any,
        });
      }

      return existingCustomer;
    };

    if (customer) {
      customer = await updateExistingCustomer(customer);
    } else {
      // Customer não existe: criar novo
      try {
        customer = await prisma.customer.create({
          data: {
            email,
            name,
            phone,
            dateOfBirth,
            ssn,
            passport,
            cpf,
            address,
            city,
            state,
            zipCode,
            country,
            clint_contact_id: externalIds.clint_contact_id,
            lastClintSyncAt: externalIds.clint_contact_id ? syncDate : undefined,
            quickbooks_id: externalIds.quickbooks_id,
            docusign_id: externalIds.docusign_id,
            trello_id: externalIds.trello_id,
            cloudtalk_id: externalIds.cloudtalk_id,
            google_contact_id: externalIds.google_contact_id,
            metadata: metadata || {},
          },
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) {
          throw error;
        }

        const conflictingCustomer =
          await this.findByAnyExternalId(externalIds) ??
          await prisma.customer.findUnique({ where: { email } });

        if (!conflictingCustomer) {
          throw error;
        }

        customer = await updateExistingCustomer(conflictingCustomer);
      }
    }

    return customer;
  }

  /**
   * Buscar Customer por ID externo
   */
  async findByExternalId(
    service: "clint" | "quickbooks" | "docusign" | "trello" | "cloudtalk" | "google_contact",
    externalId: string | number
  ): Promise<Customer | null> {
    const where: any = {};

    switch (service) {
      case "clint":
        where.clint_contact_id = String(externalId);
        break;
      case "quickbooks":
        where.quickbooks_id = String(externalId);
        break;
      case "docusign":
        where.docusign_id = String(externalId);
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
    service: "clint" | "quickbooks" | "docusign" | "trello" | "cloudtalk" | "google_contact",
    externalId: string | number
  ): Promise<Customer> {
    const updates: any = {};

    switch (service) {
      case "clint":
        updates.clint_contact_id = String(externalId);
        break;
      case "quickbooks":
        updates.quickbooks_id = String(externalId);
        break;
      case "docusign":
        updates.docusign_id = String(externalId);
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

  /**
   * Sync customer data to DocuSign
   * Only syncs if name, email, or phone changed to avoid API spam
   */
  async syncToDocuSign(customerId: string): Promise<boolean> {
    try {
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });

      if (!customer) {
        console.log(`[IDENTITY_MAPPER] Customer ${customerId} not found for DocuSign sync`);
        return false;
      }

      // Only sync if customer has significant fields to update
      if (!customer.name || !customer.email) {
        console.log(`[IDENTITY_MAPPER] Customer ${customerId} missing required fields for DocuSign sync`);
        return false;
      }

      // Import dynamically to avoid circular dependency
      const { docusignService } = await import("./docusign.service");

      // Create or update contact in DocuSign
      const docusignId = await docusignService.createOrUpdateContact({
        email: customer.email,
        name: customer.name,
        phone: customer.phone || undefined,
      });

      if (docusignId) {
        // Update customer with DocuSign ID and sync timestamp
        await prisma.customer.update({
          where: { id: customerId },
          data: {
            docusign_id: docusignId,
            lastDocusignSyncAt: new Date(),
          },
        });

        console.log(`[IDENTITY_MAPPER] Synced customer ${customerId} to DocuSign: ${docusignId}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error(`[IDENTITY_MAPPER] Failed to sync customer ${customerId} to DocuSign:`, error);
      // Don't throw - graceful degradation
      return false;
    }
  }

  /**
   * Sync customer data from DocuSign
   * Uses last-write-wins conflict resolution based on timestamps
   */
  async syncFromDocuSign(
    docusignId: string,
    customerData: { email: string; name: string; phone?: string }
  ): Promise<Customer | null> {
    try {
      // Find customer by DocuSign ID
      let customer = await prisma.customer.findFirst({
        where: { docusign_id: docusignId },
      });

      if (!customer) {
        // Customer doesn't exist - try to find by email
        customer = await prisma.customer.findUnique({
          where: { email: customerData.email },
        });

        if (!customer) {
          // Create new customer
          customer = await prisma.customer.create({
            data: {
              email: customerData.email,
              name: customerData.name,
              phone: customerData.phone,
              docusign_id: docusignId,
              lastDocusignSyncAt: new Date(),
            },
          });

          console.log(`[IDENTITY_MAPPER] Created customer from DocuSign: ${customer.id}`);
          return customer;
        } else {
          // Customer exists - add DocuSign ID
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: {
              docusign_id: docusignId,
              lastDocusignSyncAt: new Date(),
            },
          });

          console.log(`[IDENTITY_MAPPER] Linked existing customer ${customer.id} to DocuSign: ${docusignId}`);
          return customer;
        }
      }

      // Customer exists - check if we should update based on last-write-wins
      const now = new Date();
      const updates: any = { lastDocusignSyncAt: now };

      // Only update if DocuSign data is newer or timestamp is missing
      const shouldUpdate =
        !customer.lastDocusignSyncAt ||
        !customer.updatedAt ||
        customer.lastDocusignSyncAt < customer.updatedAt;

      if (shouldUpdate) {
        // Update fields that differ
        if (customerData.name && customerData.name !== customer.name) {
          updates.name = customerData.name;
        }
        if (customerData.phone && customerData.phone !== customer.phone) {
          updates.phone = customerData.phone;
        }

        if (Object.keys(updates).length > 1) {
          // More than just timestamp
          customer = await prisma.customer.update({
            where: { id: customer.id },
            data: updates,
          });

          console.log(`[IDENTITY_MAPPER] Updated customer ${customer.id} from DocuSign`);
        }
      } else {
        console.log(`[IDENTITY_MAPPER] Skipped update for customer ${customer.id} - local data is newer`);
      }

      return customer;
    } catch (error) {
      console.error(`[IDENTITY_MAPPER] Failed to sync from DocuSign ${docusignId}:`, error);
      return null;
    }
  }
}

export const identityMapper = new IdentityMapperService();
