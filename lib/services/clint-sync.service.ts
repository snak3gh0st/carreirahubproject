/**
 * Clint Sync Service
 *
 * Pull contacts + deals do Clint e upsert no DB local.
 * Roda via cron a cada 6h. Sem reverse-sync na V1.
 */
import { prisma } from "@/lib/db";
import { clintService } from "./clint.service";
import { identityMapper } from "./identity-mapper";
import { integrationLogger } from "@/lib/utils/logger";

export class ClintSyncService {
  /** Sincroniza contatos Clint → Customer / Lead local */
  async syncContacts(): Promise<{ upserted: number; errors: number }> {
    let upserted = 0;
    let errors = 0;

    const contacts = await clintService.getAllContacts();

    for (const contact of contacts) {
      try {
        const email = contact.email;
        if (!email) continue;

        const phone = contact.ddi
          ? `+${contact.ddi}${contact.phone ?? ""}`
          : contact.phone ?? undefined;

        await identityMapper.reconcileCustomer({
          email,
          name: contact.name || email,
          phone,
          externalIds: { clint_contact_id: contact.id },
        });

        upserted++;
      } catch (err) {
        errors++;
        await integrationLogger.logError(
          "clint-sync",
          "syncContacts",
          err as Error,
          { errorCode: "UPSERT_FAILED", category: "unknown", metadata: { contactId: contact.id } },
          { contactId: contact.id }
        );
      }
    }

    return { upserted, errors };
  }

  /** Sincroniza deals Clint → Deal local */
  async syncDeals(): Promise<{ upserted: number; errors: number }> {
    let upserted = 0;
    let errors = 0;

    const deals = await clintService.getAllDeals();

    for (const deal of deals) {
      try {
        // Tentar encontrar customer associado
        let customerId: string | undefined;
        if (deal.contact_id) {
          const customer = await prisma.customer.findUnique({
            where: { clint_contact_id: deal.contact_id },
            select: { id: true },
          });
          customerId = customer?.id;
        }

        const title = deal.name ?? deal.title ?? `Deal ${deal.id}`;
        const value = deal.value ?? 0;

        const clintStatus = String(deal.status ?? "").toLowerCase();
        const status =
          clintStatus.includes("ganho") || clintStatus === "won"
            ? "WON"
            : clintStatus.includes("perdido") || clintStatus === "lost"
            ? "LOST"
            : "OPEN";

        await prisma.deal.upsert({
          where: { clint_deal_id: deal.id },
          update: {
            title,
            value,
            status: status as any,
            lastClintSyncAt: new Date(),
            ...(customerId ? { customerId } : {}),
          },
          create: {
            title,
            value,
            currency: "USD",
            status: status as any,
            clint_deal_id: deal.id,
            lastClintSyncAt: new Date(),
            ...(customerId ? { customerId } : {}),
          },
        });

        upserted++;
      } catch (err) {
        errors++;
        await integrationLogger.logError(
          "clint-sync",
          "syncDeals",
          err as Error,
          { errorCode: "UPSERT_FAILED", category: "unknown", metadata: { dealId: deal.id } },
          { dealId: deal.id }
        );
      }
    }

    return { upserted, errors };
  }

  /** Full sync: contacts + deals. Debounce: skip se última sync < 5 min */
  async syncAll(): Promise<{ contacts: { upserted: number; errors: number }; deals: { upserted: number; errors: number } }> {
    const config = await prisma.systemConfig.findUnique({ where: { id: "system" } });

    if (config?.last_clint_sync) {
      const elapsed = Date.now() - config.last_clint_sync.getTime();
      if (elapsed < 5 * 60 * 1000) {
        return { contacts: { upserted: 0, errors: 0 }, deals: { upserted: 0, errors: 0 } };
      }
    }

    const contacts = await this.syncContacts();
    const deals = await this.syncDeals();

    await prisma.systemConfig.upsert({
      where: { id: "system" },
      update: { last_clint_sync: new Date() },
      create: { id: "system", last_clint_sync: new Date() },
    });

    return { contacts, deals };
  }
}

export const clintSyncService = new ClintSyncService();
