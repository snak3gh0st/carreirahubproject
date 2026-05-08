/**
 * Clint Sync Service
 *
 * Pull contacts + deals do Clint e upsert no DB local.
 * Roda via cron a cada 6h. Sem reverse-sync na V1.
 */
import { prisma } from "@/lib/db";
import { clintService, type ClintDeal } from "./clint.service";
import { identityMapper } from "./identity-mapper";
import { integrationLogger } from "@/lib/utils/logger";

type ClintDealWriteContext = {
  customerId?: string;
  userIdByEmail: Map<string, string>;
  syncTimestamp: Date;
};

type ClintDealWriteData = {
  title: string;
  value: number;
  currency: string;
  status: "WON" | "LOST" | "OPEN";
  customerId?: string;
  ownerId?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastClintSyncAt: Date;
};

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.includes("@") ? normalized : null;
}

function parseClintDate(value: unknown): Date | undefined {
  if (typeof value !== "string") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function extractClintOwnerEmail(deal: ClintDeal): string | null {
  const record = deal as Record<string, any>;
  return (
    normalizeEmail(record.user?.email) ||
    normalizeEmail(record.owner?.email) ||
    normalizeEmail(record.owner_email) ||
    normalizeEmail(record.user_email)
  );
}

export function normalizeClintDealStatus(status: unknown): "WON" | "LOST" | "OPEN" {
  const normalized = String(status ?? "").trim().toLowerCase();
  if (normalized === "won" || normalized.includes("ganho")) return "WON";
  if (normalized === "lost" || normalized.includes("perdido")) return "LOST";
  return "OPEN";
}

export function buildClintDealWriteData(
  deal: ClintDeal,
  context: ClintDealWriteContext
): ClintDealWriteData {
  const ownerEmail = extractClintOwnerEmail(deal);
  const ownerId = ownerEmail ? context.userIdByEmail.get(ownerEmail) : undefined;
  const createdAt = parseClintDate(deal.created_at);
  const updatedAt = parseClintDate(deal.updated_at);

  return {
    title: deal.name ?? deal.title ?? `Deal ${deal.id}`,
    value: Number(deal.value ?? 0),
    currency: "USD",
    status: normalizeClintDealStatus(deal.status),
    lastClintSyncAt: context.syncTimestamp,
    ...(context.customerId ? { customerId: context.customerId } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  };
}

export class ClintSyncService {
  /** Sincroniza contatos Clint → Customer / Lead local */
  async syncContacts(options: { maxPages?: number } = {}): Promise<{ upserted: number; errors: number }> {
    let upserted = 0;
    let errors = 0;
    const upsertBatchSize = 20;

    const contacts = await clintService.getAllContacts(options.maxPages);
    const syncableContacts = Array.from(
      contacts.reduce((map, contact) => {
        const email = normalizeEmail(contact.email);
        if (email && !map.has(email)) {
          map.set(email, contact);
        }
        return map;
      }, new Map<string, (typeof contacts)[number]>()).values()
    );

    for (let index = 0; index < syncableContacts.length; index += upsertBatchSize) {
      const batch = syncableContacts.slice(index, index + upsertBatchSize);
      const results = await Promise.all(batch.map(async (contact) => {
        try {
          const email = contact.email;
          if (!email) return false;

          const phone = contact.ddi
            ? `+${contact.ddi}${contact.phone ?? ""}`
            : contact.phone ?? undefined;

          await identityMapper.reconcileCustomer({
            email,
            name: contact.name || email,
            phone,
            externalIds: { clint_contact_id: contact.id },
          });

          return true;
        } catch (err) {
          await integrationLogger.logError(
            "clint-sync",
            "syncContacts",
            err as Error,
            { errorCode: "UPSERT_FAILED", category: "unknown", metadata: { contactId: contact.id } },
            { contactId: contact.id }
          );
          return false;
        }
      }));

      upserted += results.filter(Boolean).length;
      errors += results.filter((success) => !success).length;
    }

    return { upserted, errors };
  }

  /** Sincroniza deals Clint → Deal local */
  async syncDeals(options: { maxPages?: number } = {}): Promise<{ upserted: number; errors: number }> {
    let upserted = 0;
    let errors = 0;
    const upsertBatchSize = 20;

    const deals = await clintService.getAllDeals(options.maxPages);
    const syncTimestamp = new Date();
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, email: true },
    });
    const userIdByEmail = new Map(
      users.map((user) => [user.email.trim().toLowerCase(), user.id])
    );
    const clintContactIds = Array.from(new Set(
      deals
        .map((deal) => deal.contact_id)
        .filter((contactId): contactId is string => Boolean(contactId))
    ));
    const customers = clintContactIds.length > 0
      ? await prisma.customer.findMany({
          where: { clint_contact_id: { in: clintContactIds } },
          select: { id: true, clint_contact_id: true },
        })
      : [];
    const customerIdByClintContactId = new Map(
      customers
        .filter((customer) => Boolean(customer.clint_contact_id))
        .map((customer) => [customer.clint_contact_id as string, customer.id])
    );

    for (let index = 0; index < deals.length; index += upsertBatchSize) {
      const batch = deals.slice(index, index + upsertBatchSize);
      const results = await Promise.all(batch.map(async (deal) => {
        try {
          const customerId = deal.contact_id
            ? customerIdByClintContactId.get(deal.contact_id)
            : undefined;

          const writeData = buildClintDealWriteData(deal, {
            customerId,
            userIdByEmail,
            syncTimestamp,
          });

          await prisma.deal.upsert({
            where: { clint_deal_id: deal.id },
            update: {
              title: writeData.title,
              value: writeData.value,
              currency: writeData.currency,
              status: writeData.status,
              lastClintSyncAt: writeData.lastClintSyncAt,
              ...(writeData.customerId ? { customerId: writeData.customerId } : {}),
              ...(writeData.ownerId ? { ownerId: writeData.ownerId } : {}),
              ...(writeData.createdAt ? { createdAt: writeData.createdAt } : {}),
              ...(writeData.updatedAt ? { updatedAt: writeData.updatedAt } : {}),
            },
            create: {
              title: writeData.title,
              value: writeData.value,
              currency: writeData.currency,
              status: writeData.status,
              clint_deal_id: deal.id,
              lastClintSyncAt: writeData.lastClintSyncAt,
              ...(writeData.customerId ? { customerId: writeData.customerId } : {}),
              ...(writeData.ownerId ? { ownerId: writeData.ownerId } : {}),
              ...(writeData.createdAt ? { createdAt: writeData.createdAt } : {}),
              ...(writeData.updatedAt ? { updatedAt: writeData.updatedAt } : {}),
            },
          });

          return true;
        } catch (err) {
          await integrationLogger.logError(
            "clint-sync",
            "syncDeals",
            err as Error,
            { errorCode: "UPSERT_FAILED", category: "unknown", metadata: { dealId: deal.id } },
            { dealId: deal.id }
          );
          return false;
        }
      }));

      upserted += results.filter(Boolean).length;
      errors += results.filter((success) => !success).length;
    }

    return { upserted, errors };
  }

  /** Full sync: contacts + deals. Only complete, error-free runs mark global Clint freshness. */
  async syncAll(options: { maxPages?: number } = {}): Promise<{ contacts: { upserted: number; errors: number }; deals: { upserted: number; errors: number } }> {
    const contacts = await this.syncContacts({ maxPages: options.maxPages });
    const deals = await this.syncDeals({ maxPages: options.maxPages });
    const completedFullSync = !options.maxPages && contacts.errors === 0 && deals.errors === 0;

    if (completedFullSync) {
      await prisma.systemConfig.upsert({
        where: { id: "system" },
        update: { last_clint_sync: new Date() },
        create: { id: "system", last_clint_sync: new Date() },
      });
    }

    await integrationLogger.logSuccess("clint-sync", "syncAll", {
      contacts,
      deals,
      maxPages: options.maxPages ?? null,
      completedFullSync,
    });

    return { contacts, deals };
  }
}

export const clintSyncService = new ClintSyncService();
