/**
 * Clint Event Processor
 *
 * Responsabilidade: Rotear eventos do webhook Clint para os serviços do Hub.
 * Também expõe triggerOnboarding() — usado pelo webhook DocuSign e pelo handler de pagamento.
 *
 * Princípio: Hub é o SSOT. O Clint é apenas fonte de eventos.
 */
import { prisma } from "@/lib/db";
import { identityMapper } from "@/lib/services/identity-mapper";
import { leadService } from "@/lib/services/lead.service";
import { sdrService } from "@/lib/services/sdr.service";
import { invoiceWorkflowService } from "@/lib/services/invoice-workflow.service";
import { slackService } from "@/lib/services/slack.service";
import { integrationLogger } from "@/lib/utils/logger";
import type { ClintContact, ClintDeal } from "@/lib/services/clint.service";

export class ClintEventProcessor {

  // ─── Contact Created ─────────────────────────────────────────────────────

  async handleContactCreated(contact: Partial<ClintContact>): Promise<void> {
    if (!contact.email) {
      console.warn("[ClintEvent] contact.created without email — skipping", contact.id);
      return;
    }

    const phone = contact.ddi
      ? `+${contact.ddi}${contact.phone ?? ""}`
      : contact.phone ?? undefined;

    const customer = await identityMapper.reconcileCustomer({
      email: contact.email,
      name: contact.name || contact.email,
      phone,
      externalIds: { clint_contact_id: contact.id! },
    });

    // Save extra Clint metadata for AI context
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        metadata: {
          ...(customer.metadata as object ?? {}),
          clint_raw: {
            id: contact.id,
            ddi: contact.ddi,
            created_at: contact.created_at,
            updated_at: contact.updated_at,
          },
        },
      },
    });

    // Create lead (idempotent — leadService checks by email)
    const lead = await leadService.createLead({
      email: customer.email,
      name: customer.name,
      phone: customer.phone ?? undefined,
      source: "CLINT" as any,
      clint_contact_id: contact.id,
    });

    // Trigger AI qualification async (fire-and-forget)
    sdrService.autoQualifyLead(lead.id).catch((err: unknown) =>
      console.error("[ClintEvent] autoQualifyLead failed:", err)
    );

    await slackService.notifyNewLead(lead, customer);

    await integrationLogger.logSuccess("clint-event", "contact_created", {
      clint_contact_id: contact.id,
      customerId: customer.id,
      leadId: lead.id,
    });
  }

  // ─── Contact Updated ─────────────────────────────────────────────────────

  async handleContactUpdated(contact: Partial<ClintContact>): Promise<void> {
    if (!contact.email) return;

    const phone = contact.ddi
      ? `+${contact.ddi}${contact.phone ?? ""}`
      : contact.phone ?? undefined;

    await identityMapper.reconcileCustomer({
      email: contact.email,
      name: contact.name || contact.email,
      phone,
      externalIds: { clint_contact_id: contact.id! },
    });

    await integrationLogger.logSuccess("clint-event", "contact_updated", {
      clint_contact_id: contact.id,
    });
  }

  // ─── Deal Stage Changed ──────────────────────────────────────────────────

  async handleDealStageChanged(
    deal: Partial<ClintDeal> & { from_stage?: string; to_stage?: string }
  ): Promise<void> {
    const existing = await prisma.deal.findUnique({
      where: { clint_deal_id: deal.id },
    });

    if (!existing) {
      console.warn("[ClintEvent] deal.stage_changed for unknown deal:", deal.id);
      return;
    }

    const clintStatus = String(deal.status ?? "").toLowerCase();
    const status =
      clintStatus.includes("ganho") || clintStatus === "won"
        ? "WON"
        : clintStatus.includes("perdido") || clintStatus === "lost"
        ? "LOST"
        : "OPEN";

    await prisma.deal.update({
      where: { id: existing.id },
      data: {
        status: status as any,
        lastClintSyncAt: new Date(),
      },
    });

    await slackService.notifyDealStageChange(
      { id: existing.id, title: existing.title, value: existing.value as any },
      deal.from_stage ?? "—",
      deal.to_stage ?? String(deal.status ?? "—")
    );

    await integrationLogger.logSuccess("clint-event", "deal_stage_changed", {
      clint_deal_id: deal.id,
      dealId: existing.id,
      from: deal.from_stage,
      to: deal.to_stage,
    });
  }

  // ─── Deal Won ────────────────────────────────────────────────────────────

  async handleDealWon(deal: Partial<ClintDeal>): Promise<void> {
    let customerId: string | undefined;
    let customer: any;

    if (deal.contact_id) {
      customer = await prisma.customer.findUnique({
        where: { clint_contact_id: deal.contact_id },
      });
      if (customer) customerId = customer.id;
    }

    const title = deal.name ?? deal.title ?? `Deal ${deal.id}`;
    const value = deal.value ?? 0;

    const hubDeal = await prisma.deal.upsert({
      where: { clint_deal_id: deal.id! },
      create: {
        title,
        value,
        currency: "USD",
        status: "WON",
        clint_deal_id: deal.id!,
        lastClintSyncAt: new Date(),
        ...(customerId ? { customerId } : {}),
      },
      update: {
        title,
        value,
        status: "WON",
        lastClintSyncAt: new Date(),
        ...(customerId ? { customerId } : {}),
      },
    });

    // Trigger invoice + DocuSign contract workflow
    await invoiceWorkflowService.processDealWon(hubDeal.id);

    if (customer) {
      await slackService.notifyDealWon(
        { id: hubDeal.id, title: hubDeal.title, value: hubDeal.value as any },
        customer
      );
    }

    await integrationLogger.logSuccess("clint-event", "deal_won", {
      clint_deal_id: deal.id,
      dealId: hubDeal.id,
      customerId,
    });
  }

  // ─── Onboarding Gate ─────────────────────────────────────────────────────
  // Called by: DocuSign webhook (envelope-completed) AND payment handler (invoice PAID).
  // Creates MentorshipEnrollment only when BOTH contract SIGNED + invoice PAID.

  async triggerOnboarding(
    dealId: string,
    customer: { id: string; name?: string | null; email: string; phone?: string | null }
  ): Promise<void> {
    // Detect program type from deal title (ADVANCED takes precedence, default PASS)
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { title: true },
    });

    const programType: string = this.detectProgram(deal?.title ?? "");

    // Guard: don't create duplicate active enrollment
    const existing = await prisma.mentorshipEnrollment.findFirst({
      where: { customerId: customer.id, status: "ACTIVE" },
    });
    if (existing) {
      console.log(`[ClintEvent] Enrollment already exists for customer ${customer.id} — skipping`);
      return;
    }

    // Assign to first OPERATIONAL user (V1 — no round-robin)
    const opsUser = await prisma.user.findFirst({
      where: { role: "OPERATIONAL" },
      select: { id: true },
    });

    if (!opsUser) {
      console.error("[ClintEvent] No OPERATIONAL user found — cannot create enrollment");
      await integrationLogger.logError(
        "clint-event",
        "trigger_onboarding",
        new Error("No OPERATIONAL user found"),
        { errorCode: "NO_OPS_USER", category: "validation" },
        { customerId: customer.id }
      );
      return;
    }

    const enrollment = await prisma.mentorshipEnrollment.create({
      data: {
        programType,
        customerId: customer.id,
        assignedToId: opsUser.id,
        startDate: new Date(),
        status: "ACTIVE",
      },
    });

    await slackService.notifyOnboardingReady(
      { id: enrollment.id, programType: enrollment.programType },
      customer
    );

    await integrationLogger.logSuccess("clint-event", "onboarding_triggered", {
      enrollmentId: enrollment.id,
      customerId: customer.id,
      programType,
    });
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  /** Detect program type from deal title. Default: PASS */
  private detectProgram(title: string): string {
    const t = title.toUpperCase();
    if (t.includes("ADVANCED")) return "ADVANCED";
    return "PASS";
  }
}

export const clintEventProcessor = new ClintEventProcessor();
