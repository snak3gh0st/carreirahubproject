# Clint Webhook + Slack Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Clint polling cron with real-time webhooks, add Slack notifications for key events, and gate MentorshipEnrollment creation on Contract SIGNED + Invoice PAID.

**Architecture:** Clint fires webhook → `/api/webhooks/clint` validates + deduplicates → `ClintEventProcessor` calls existing Hub services (identityMapper, leadService, invoiceWorkflow) → `SlackService` notifies the right channel. The onboarding gate lives inside the existing DocuSign and QB payment handlers, calling a shared `triggerOnboarding()` function from `ClintEventProcessor`.

**Tech Stack:** Next.js App Router route handlers, Prisma, existing CircuitBreaker + IntegrationLogger utilities, Slack Web API (`chat.postMessage`), HMAC-SHA256 (`lib/utils/hmac.ts`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/services/slack.service.ts` | CREATE | Slack Bot Token auth, Block Kit messages, circuit breaker |
| `lib/services/clint-event-processor.service.ts` | CREATE | Route Clint events to Hub services, trigger onboarding |
| `app/api/webhooks/clint/route.ts` | CREATE | HMAC validation, dedup, event routing |
| `app/api/webhooks/docusign/route.ts` | MODIFY | Add onboarding gate to `envelope-completed` case |
| `app/api/hub/pay/[id]/charge/route.ts` | MODIFY | Add onboarding gate after invoice marked PAID |
| `vercel.json` | MODIFY | Add daily clint-sync cron (fallback safety net) |

---

## Task 1: Slack Service

**Files:**
- Create: `lib/services/slack.service.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/services/__tests__/slack.service.test.ts`:

```typescript
import { SlackService } from '../slack.service';

// Mock fetch globally
global.fetch = jest.fn();

describe('SlackService', () => {
  let service: SlackService;

  beforeEach(() => {
    (global.fetch as jest.Mock).mockReset();
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_CHANNEL_COMMERCIAL = 'C0COMMERCIAL';
    process.env.SLACK_CHANNEL_BASTAO = 'C0BASTAO';
    service = new SlackService();
  });

  it('posts to commercial channel on new lead', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await service.notifyNewLead(
      { id: 'lead-1', name: 'Ana Silva', email: 'ana@test.com', source: 'CLINT' } as any,
      { id: 'cust-1', name: 'Ana Silva', email: 'ana@test.com' } as any
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://slack.com/api/chat.postMessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer xoxb-test-token' }),
      })
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.channel).toBe('C0COMMERCIAL');
    expect(body.blocks).toBeDefined();
  });

  it('returns without throwing when SLACK_BOT_TOKEN is not set', async () => {
    delete process.env.SLACK_BOT_TOKEN;
    const unconfiguredService = new SlackService();
    await expect(
      unconfiguredService.notifyNewLead({} as any, {} as any)
    ).resolves.not.toThrow();
  });

  it('posts to bastao channel on onboarding ready', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await service.notifyOnboardingReady(
      { id: 'enroll-1', programType: 'PASS' } as any,
      { id: 'cust-1', name: 'João Souza', email: 'joao@test.com' } as any
    );

    const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
    expect(body.channel).toBe('C0BASTAO');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/services/__tests__/slack.service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../slack.service'`

- [ ] **Step 3: Implement SlackService**

Create `lib/services/slack.service.ts`:

```typescript
/**
 * Slack Service
 *
 * Responsabilidade: Enviar notificações para canais Slack via Bot Token.
 * Auth: SLACK_BOT_TOKEN (xoxb-...) — um token, qualquer canal.
 * Padrão: fire-and-forget com circuit breaker + IntegrationLog.
 */
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger } from "@/lib/utils/logger";

const SLACK_API = "https://slack.com/api/chat.postMessage";

const CHANNELS = {
  commercial: process.env.SLACK_CHANNEL_COMMERCIAL ?? "",
  bastao: process.env.SLACK_CHANNEL_BASTAO ?? "",
  englishTest: process.env.SLACK_CHANNEL_ENGLISH_TEST ?? "",
};

type Lead = { id: string; name?: string | null; email: string; source?: string };
type Customer = { id: string; name?: string | null; email: string; phone?: string | null };
type Deal = { id: string; title: string; value?: number | string | null; clint_deal_id?: string | null };
type Enrollment = { id: string; programType: string };

export class SlackService {
  private token: string;
  private cb: CircuitBreaker;

  constructor() {
    this.token = process.env.SLACK_BOT_TOKEN ?? "";
    this.cb = new CircuitBreaker("slack");
  }

  private async post(channel: string, blocks: object[], text: string): Promise<void> {
    if (!this.token || !channel) {
      console.warn("[Slack] Token or channel not configured — skipping notification");
      return;
    }

    const start = Date.now();
    try {
      await this.cb.execute(async () => {
        const res = await fetch(SLACK_API, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ channel, text, blocks }),
        });
        const data = await res.json() as { ok: boolean; error?: string };
        if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
      });
      await integrationLogger.logSuccess("slack", "post_message", { channel, text });
    } catch (err) {
      if (err instanceof CircuitOpenError) {
        console.warn("[Slack] Circuit open — skipping");
        return;
      }
      await integrationLogger.logError(
        "slack",
        "post_message",
        err as Error,
        { errorCode: "SLACK_POST_FAILED", category: "transient" },
        { channel },
        Date.now() - start
      );
      // Best-effort: never throw. Slack failure must not break the main flow.
    }
  }

  async notifyNewLead(lead: Lead, customer: Customer): Promise<void> {
    await this.post(CHANNELS.commercial, [
      {
        type: "header",
        text: { type: "plain_text", text: "🟢 Novo Lead — Clint" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Nome:*\n${customer.name ?? lead.email}` },
          { type: "mrkdwn", text: `*E-mail:*\n${lead.email}` },
          { type: "mrkdwn", text: `*Telefone:*\n${customer.phone ?? "—"}` },
          { type: "mrkdwn", text: `*Origem:*\nClint CRM` },
        ],
      },
    ], `Novo lead: ${customer.name ?? lead.email}`);
  }

  async notifyLeadQualified(lead: Lead, score: number): Promise<void> {
    await this.post(CHANNELS.commercial, [
      {
        type: "header",
        text: { type: "plain_text", text: "⭐ Lead Qualificado" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Nome:*\n${lead.name ?? lead.email}` },
          { type: "mrkdwn", text: `*Score:*\n${score}/100` },
        ],
      },
    ], `Lead qualificado: ${lead.name ?? lead.email} (score ${score})`);
  }

  async notifyDealWon(deal: Deal, customer: Customer): Promise<void> {
    const value = deal.value ? `$${Number(deal.value).toLocaleString("en-US")}` : "—";
    await this.post(CHANNELS.commercial, [
      {
        type: "header",
        text: { type: "plain_text", text: "🏆 Deal Ganho — Clint" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Cliente:*\n${customer.name ?? customer.email}` },
          { type: "mrkdwn", text: `*Deal:*\n${deal.title}` },
          { type: "mrkdwn", text: `*Valor:*\n${value}` },
          { type: "mrkdwn", text: `*E-mail:*\n${customer.email}` },
        ],
      },
    ], `Deal ganho: ${deal.title} — ${customer.name ?? customer.email}`);
  }

  async notifyDealStageChange(deal: Deal, fromStage: string, toStage: string): Promise<void> {
    await this.post(CHANNELS.commercial, [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Deal movido:* ${deal.title}\n*De:* ${fromStage} → *Para:* ${toStage}`,
        },
      },
    ], `Deal ${deal.title}: ${fromStage} → ${toStage}`);
  }

  async notifyOnboardingReady(enrollment: Enrollment, customer: Customer): Promise<void> {
    await this.post(CHANNELS.bastao, [
      {
        type: "header",
        text: { type: "plain_text", text: "🎓 Aluno Pronto para Onboarding" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Nome:*\n${customer.name ?? customer.email}` },
          { type: "mrkdwn", text: `*E-mail:*\n${customer.email}` },
          { type: "mrkdwn", text: `*Programa:*\n${enrollment.programType}` },
          { type: "mrkdwn", text: `*Telefone:*\n${customer.phone ?? "—"}` },
        ],
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: "✅ Contrato assinado + invoice paga. Pronto para Passagem de Bastão.",
        },
      },
    ], `Onboarding pronto: ${customer.name ?? customer.email} (${enrollment.programType})`);
  }
}

export const slackService = new SlackService();
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest lib/services/__tests__/slack.service.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/services/slack.service.ts lib/services/__tests__/slack.service.test.ts
git commit -m "feat(slack): add SlackService with Block Kit notifications"
```

---

## Task 2: Clint Event Processor

**Files:**
- Create: `lib/services/clint-event-processor.service.ts`
- Create: `lib/services/__tests__/clint-event-processor.service.test.ts`

This service is the brain of the integration. It receives parsed Clint events and calls existing Hub services in the right order. It also owns the `triggerOnboarding()` function used by both the DocuSign and payment webhooks.

- [ ] **Step 1: Write the failing test**

Create `lib/services/__tests__/clint-event-processor.service.test.ts`:

```typescript
import { ClintEventProcessor } from '../clint-event-processor.service';

// Mock all dependencies
jest.mock('@/lib/db', () => ({
  prisma: {
    deal: {
      upsert: jest.fn().mockResolvedValue({ id: 'deal-1', title: 'Test Deal', value: 1000, status: 'WON', clint_deal_id: 'clint-deal-1', customerId: 'cust-1' }),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    mentorshipEnrollment: {
      create: jest.fn().mockResolvedValue({ id: 'enroll-1', programType: 'PASS' }),
    },
    user: {
      findFirst: jest.fn().mockResolvedValue({ id: 'user-ops-1', role: 'OPERATIONAL' }),
    },
    contract: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    invoice: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
  },
}));

jest.mock('@/lib/services/identity-mapper', () => ({
  identityMapper: {
    reconcileCustomer: jest.fn().mockResolvedValue({
      id: 'cust-1', name: 'Ana Silva', email: 'ana@test.com', phone: '+1111111111',
    }),
  },
}));

jest.mock('@/lib/services/lead.service', () => ({
  leadService: {
    createLead: jest.fn().mockResolvedValue({ id: 'lead-1', email: 'ana@test.com', name: 'Ana Silva', source: 'CLINT' }),
    getLeadByEmail: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('@/lib/services/sdr.service', () => ({
  sdrService: {
    autoQualifyLead: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/services/invoice-workflow.service', () => ({
  invoiceWorkflowService: {
    processDealWon: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/services/slack.service', () => ({
  slackService: {
    notifyNewLead: jest.fn().mockResolvedValue(undefined),
    notifyDealWon: jest.fn().mockResolvedValue(undefined),
    notifyDealStageChange: jest.fn().mockResolvedValue(undefined),
    notifyOnboardingReady: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  integrationLogger: {
    logSuccess: jest.fn(),
    logError: jest.fn(),
  },
}));

describe('ClintEventProcessor', () => {
  let processor: ClintEventProcessor;

  beforeEach(() => {
    jest.clearAllMocks();
    processor = new ClintEventProcessor();
  });

  describe('handleContactCreated', () => {
    it('reconciles customer and creates lead', async () => {
      const { identityMapper } = require('@/lib/services/identity-mapper');
      const { leadService } = require('@/lib/services/lead.service');
      const { slackService } = require('@/lib/services/slack.service');

      await processor.handleContactCreated({
        id: 'clint-contact-1',
        name: 'Ana Silva',
        email: 'ana@test.com',
        phone: '11999999999',
        ddi: '55',
      });

      expect(identityMapper.reconcileCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@test.com', externalIds: { clint_contact_id: 'clint-contact-1' } })
      );
      expect(leadService.createLead).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@test.com', source: 'CLINT' })
      );
      expect(slackService.notifyNewLead).toHaveBeenCalled();
    });

    it('skips contacts without email', async () => {
      const { identityMapper } = require('@/lib/services/identity-mapper');
      await processor.handleContactCreated({ id: 'c-1', name: 'No Email' });
      expect(identityMapper.reconcileCustomer).not.toHaveBeenCalled();
    });
  });

  describe('handleDealWon', () => {
    it('upserts deal as WON and triggers invoice workflow', async () => {
      const { prisma } = require('@/lib/db');
      const { invoiceWorkflowService } = require('@/lib/services/invoice-workflow.service');
      const { slackService } = require('@/lib/services/slack.service');

      prisma.deal.upsert.mockResolvedValueOnce({
        id: 'deal-1', title: 'Test', value: 1000, status: 'WON',
        clint_deal_id: 'clint-deal-1', customerId: 'cust-1',
      });

      await processor.handleDealWon({
        id: 'clint-deal-1',
        name: 'Test Deal',
        value: 1000,
        status: 'won',
        contact_id: 'clint-contact-1',
      });

      expect(prisma.deal.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clint_deal_id: 'clint-deal-1' } })
      );
      expect(invoiceWorkflowService.processDealWon).toHaveBeenCalledWith('deal-1');
      expect(slackService.notifyDealWon).toHaveBeenCalled();
    });
  });

  describe('triggerOnboarding', () => {
    it('creates enrollment and notifies Slack when ops user found', async () => {
      const { prisma } = require('@/lib/db');
      const { slackService } = require('@/lib/services/slack.service');

      await processor.triggerOnboarding('deal-1', {
        id: 'cust-1', name: 'João', email: 'joao@test.com',
      } as any);

      expect(prisma.mentorshipEnrollment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customerId: 'cust-1',
            programType: expect.any(String),
            assignedToId: 'user-ops-1',
          }),
        })
      );
      expect(slackService.notifyOnboardingReady).toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest lib/services/__tests__/clint-event-processor.service.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../clint-event-processor.service'`

- [ ] **Step 3: Implement ClintEventProcessor**

Create `lib/services/clint-event-processor.service.ts`:

```typescript
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

    // Create lead (idempotent — lead.service checks by email)
    const lead = await leadService.createLead({
      email: customer.email,
      name: customer.name,
      phone: customer.phone ?? undefined,
      source: "CLINT",
      customerId: customer.id,
    });

    // Trigger AI qualification async (fire-and-forget)
    sdrService.autoQualifyLead(lead.id).catch((err) =>
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

  async handleDealStageChanged(deal: Partial<ClintDeal> & { from_stage?: string; to_stage?: string }): Promise<void> {
    const existing = await prisma.deal.findUnique({
      where: { clint_deal_id: deal.id },
    });

    if (!existing) {
      console.warn("[ClintEvent] deal.stage_changed for unknown deal:", deal.id);
      return;
    }

    const clintStatus = String(deal.status ?? "").toLowerCase();
    const status =
      clintStatus.includes("ganho") || clintStatus === "won" ? "WON"
      : clintStatus.includes("perdido") || clintStatus === "lost" ? "LOST"
      : "OPEN";

    await prisma.deal.update({
      where: { id: existing.id },
      data: {
        status: status as any,
        lastClintSyncAt: new Date(),
        metadata: {
          ...(existing.metadata as object ?? {}),
          clint_stage: deal.to_stage ?? deal.status,
        },
      },
    });

    await slackService.notifyDealStageChange(
      existing,
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
    // Resolve customer from contact_id or fall back to existing record
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
        metadata: { clint_stage: "won", clint_program: this.detectProgram(title) },
        ...(customerId ? { customerId } : {}),
      },
      update: {
        title,
        value,
        status: "WON",
        lastClintSyncAt: new Date(),
        metadata: { clint_stage: "won", clint_program: this.detectProgram(title) },
        ...(customerId ? { customerId } : {}),
      },
    });

    // Trigger invoice + contract workflow (DocuSign)
    await invoiceWorkflowService.processDealWon(hubDeal.id);

    if (customer) {
      await slackService.notifyDealWon(hubDeal, customer);
    }

    await integrationLogger.logSuccess("clint-event", "deal_won", {
      clint_deal_id: deal.id,
      dealId: hubDeal.id,
      customerId,
    });
  }

  // ─── Onboarding Gate ─────────────────────────────────────────────────────
  // Called by: DocuSign webhook (envelope-completed) AND payment handler (invoice PAID)
  // Creates MentorshipEnrollment only when BOTH contract is SIGNED + invoice is PAID.

  async triggerOnboarding(dealId: string, customer: {
    id: string; name?: string | null; email: string; phone?: string | null;
  }): Promise<void> {
    // Look up deal to get programType from metadata
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { metadata: true },
    });

    const meta = (deal?.metadata as any) ?? {};
    const programType: string = meta.clint_program ?? "PASS";

    // Guard: don't create duplicate enrollment
    const existing = await prisma.mentorshipEnrollment.findFirst({
      where: { customerId: customer.id, status: "ACTIVE" },
    });
    if (existing) {
      console.log(`[ClintEvent] Enrollment already exists for customer ${customer.id} — skipping`);
      return;
    }

    // Assign to first OPERATIONAL user (V1 — no round-robin)
    const opsUser = await prisma.user.findFirst({
      where: { role: "OPERATIONAL", isActive: true },
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

    await slackService.notifyOnboardingReady(enrollment, customer);

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
```

- [ ] **Step 4: Check that User model has `isActive` field**

```bash
grep -n "isActive" prisma/schema.prisma
```

If `isActive` does not exist, change the `findFirst` call in `triggerOnboarding` to:

```typescript
const opsUser = await prisma.user.findFirst({
  where: { role: "OPERATIONAL" },
  select: { id: true },
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx jest lib/services/__tests__/clint-event-processor.service.test.ts --no-coverage
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/services/clint-event-processor.service.ts lib/services/__tests__/clint-event-processor.service.test.ts
git commit -m "feat(clint): add ClintEventProcessor with onboarding gate"
```

---

## Task 3: Clint Webhook Receiver

**Files:**
- Create: `app/api/webhooks/clint/route.ts`

Follows the same pattern as `app/api/webhooks/docusign/route.ts`: raw body → HMAC verify → dedup via WebhookEvent → process → 200 always.

- [ ] **Step 1: Write the failing test**

Create `app/api/webhooks/clint/__tests__/route.test.ts`:

```typescript
import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as crypto from 'crypto';

jest.mock('@/lib/db', () => ({
  prisma: {
    webhookEvent: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'we-1' }),
      update: jest.fn().mockResolvedValue({}),
    },
    integrationLog: { create: jest.fn() },
  },
}));

jest.mock('@/lib/services/clint-event-processor.service', () => ({
  clintEventProcessor: {
    handleContactCreated: jest.fn().mockResolvedValue(undefined),
    handleContactUpdated: jest.fn().mockResolvedValue(undefined),
    handleDealWon: jest.fn().mockResolvedValue(undefined),
    handleDealStageChanged: jest.fn().mockResolvedValue(undefined),
  },
}));

function makeRequest(body: object, secret?: string): NextRequest {
  const rawBody = JSON.stringify(body);
  const sig = secret
    ? crypto.createHmac('sha256', secret).update(rawBody).digest('base64')
    : 'invalid-sig';

  return new NextRequest('http://localhost/api/webhooks/clint', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Clint-Signature': sig },
    body: rawBody,
  });
}

describe('POST /api/webhooks/clint', () => {
  const secret = 'test-secret';

  beforeEach(() => {
    process.env.CLINT_WEBHOOK_SECRET = secret;
    jest.clearAllMocks();
  });

  it('returns 401 for invalid signature', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/clint', {
      method: 'POST',
      headers: { 'X-Clint-Signature': 'bad-sig' },
      body: JSON.stringify({ event: 'contact.created' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('routes contact.created to handleContactCreated', async () => {
    const { clintEventProcessor } = require('@/lib/services/clint-event-processor.service');
    const payload = { event: 'contact.created', data: { id: 'c-1', email: 'a@b.com', name: 'A' } };
    const req = makeRequest(payload, secret);
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(clintEventProcessor.handleContactCreated).toHaveBeenCalledWith(payload.data);
  });

  it('returns 200 for unknown event type (no retry)', async () => {
    const payload = { event: 'something.unknown', data: {} };
    const req = makeRequest(payload, secret);
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx jest app/api/webhooks/clint/__tests__/route.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../route'`

- [ ] **Step 3: Implement the webhook route**

Create `app/api/webhooks/clint/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyHmacSignature } from "@/lib/utils/hmac";
import { clintEventProcessor } from "@/lib/services/clint-event-processor.service";
import { integrationLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/clint
 *
 * Receives real-time events from Clint CRM.
 * Always returns 200 — Clint will retry on non-200.
 *
 * Supported events:
 *   contact.created | contact.updated | deal.won | deal.stage_changed
 */
export async function POST(request: NextRequest) {
  let webhookEventId: string | null = null;

  try {
    const rawBody = await request.text();
    const signature = request.headers.get("X-Clint-Signature");
    const secret = process.env.CLINT_WEBHOOK_SECRET;

    // Verify HMAC signature (same utility as DocuSign)
    if (secret) {
      const valid = verifyHmacSignature(rawBody, signature, secret);
      if (!valid) {
        console.error("[CLINT_WEBHOOK] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    } else {
      console.warn("[CLINT_WEBHOOK] CLINT_WEBHOOK_SECRET not set — skipping verification");
    }

    const payload = JSON.parse(rawBody) as {
      event: string;
      event_id?: string;
      data?: Record<string, unknown>;
    };

    const { event, data = {} } = payload;
    const eventId = payload.event_id ?? `${event}-${Date.now()}`;

    // Deduplicate (Clint may retry)
    const existing = await prisma.webhookEvent.findFirst({
      where: { service: "clint", event_id: eventId, status: "success" },
    });
    if (existing) {
      console.log(`[CLINT_WEBHOOK] Duplicate event ${eventId} — skipping`);
      return NextResponse.json({ ok: true, duplicate: true });
    }

    // Record event
    const webhookEvent = await prisma.webhookEvent.create({
      data: {
        service: "clint",
        event_type: event,
        event_id: eventId,
        payload: payload as any,
        headers: { signature: signature ?? "" } as any,
        status: "processing",
        max_retries: 3,
      },
    });
    webhookEventId = webhookEvent.id;

    console.log(`[CLINT_WEBHOOK] Processing event '${event}' id=${eventId}`);

    // Route to processor
    switch (event) {
      case "contact.created":
        await clintEventProcessor.handleContactCreated(data as any);
        break;
      case "contact.updated":
        await clintEventProcessor.handleContactUpdated(data as any);
        break;
      case "deal.won":
        await clintEventProcessor.handleDealWon(data as any);
        break;
      case "deal.stage_changed":
        await clintEventProcessor.handleDealStageChanged(data as any);
        break;
      default:
        console.log(`[CLINT_WEBHOOK] Unhandled event type: ${event}`);
    }

    // Mark success
    await prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: "success", processed_at: new Date() },
    });

    await integrationLogger.logSuccess("CLINT", `WEBHOOK_${event.toUpperCase().replace(/\./g, "_")}`, {
      event,
      eventId,
    });

    return NextResponse.json({ ok: true });

  } catch (error) {
    console.error("[CLINT_WEBHOOK] Error:", error);

    if (webhookEventId) {
      await prisma.webhookEvent.update({
        where: { id: webhookEventId },
        data: {
          status: "failed",
          last_error: error instanceof Error ? error.message : String(error),
          retry_count: { increment: 1 },
        },
      }).catch(() => {});
    }

    await integrationLogger.logError(
      "CLINT",
      "WEBHOOK_ERROR",
      error instanceof Error ? error : new Error(String(error)),
      { errorCode: "PROCESSING_FAILED", category: "transient" },
      {}
    );

    // Return 200 — Clint retries on non-200, which we don't want for hard errors
    return NextResponse.json({ ok: false, error: String(error) });
  }
}

export async function GET() {
  return NextResponse.json({ service: "Clint Webhook Handler", status: "active" });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx jest app/api/webhooks/clint/__tests__/route.test.ts --no-coverage
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/webhooks/clint/route.ts app/api/webhooks/clint/__tests__/route.test.ts
git commit -m "feat(clint): add webhook receiver with HMAC validation and event routing"
```

---

## Task 4: Onboarding Gate — DocuSign Webhook

**Files:**
- Modify: `app/api/webhooks/docusign/route.ts` (lines 206–365, `envelope-completed` case)

When the contract is signed, check if the invoice is already paid. If yes, trigger onboarding. If no, set a metadata flag so the payment handler can pick it up later.

- [ ] **Step 1: Locate the exact insertion point**

Open `app/api/webhooks/docusign/route.ts`. Find the `envelope-completed` case. The last action before the `break` is the seller notification block (ends around line 365). The insertion goes **after `contractWorkflowService.handleContractSigned(contract.id)`** and **before the S3 download block**.

- [ ] **Step 2: Add the onboarding gate to `envelope-completed`**

In `app/api/webhooks/docusign/route.ts`, add this import at the top of the file (after existing imports):

```typescript
import { clintEventProcessor } from '@/lib/services/clint-event-processor.service';
```

Then inside the `envelope-completed` case, after the `contractWorkflowService.handleContractSigned(contract.id)` call and before the S3 download block, add:

```typescript
        // Onboarding gate: trigger if invoice is already PAID
        if (contract.dealId && contract.customer) {
          try {
            const linkedInvoice = await prisma.invoice.findFirst({
              where: { dealId: contract.dealId, status: "PAID" },
            });
            if (linkedInvoice) {
              console.log(`[DOCUSIGN_WEBHOOK] Invoice already PAID — triggering onboarding for deal ${contract.dealId}`);
              await clintEventProcessor.triggerOnboarding(contract.dealId, contract.customer);
            } else {
              console.log(`[DOCUSIGN_WEBHOOK] Invoice not yet PAID — onboarding pending`);
            }
          } catch (onboardingErr) {
            console.error("[DOCUSIGN_WEBHOOK] Onboarding gate failed (non-blocking):", onboardingErr);
          }
        }
```

- [ ] **Step 3: Verify the file builds without TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors related to `docusign/route.ts` or `clint-event-processor.service.ts`

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/docusign/route.ts
git commit -m "feat(onboarding): add onboarding gate to DocuSign envelope-completed handler"
```

---

## Task 5: Onboarding Gate — Payment Handler

**Files:**
- Modify: `app/api/hub/pay/[id]/charge/route.ts`

When the invoice is marked PAID, check if the linked contract is already SIGNED. If yes, trigger onboarding.

- [ ] **Step 1: Add the import at the top of the payment route**

In `app/api/hub/pay/[id]/charge/route.ts`, add after existing imports:

```typescript
import { clintEventProcessor } from '@/lib/services/clint-event-processor.service';
```

- [ ] **Step 2: Locate the invoice PAID update**

Find the block that sets `status: InvoiceStatus.PAID` (around line 401). Immediately after that `prisma.invoice.update()` call, add:

```typescript
      // Onboarding gate: trigger if contract is already SIGNED
      if (invoice.dealId) {
        try {
          const { ContractStatus } = await import('@prisma/client');
          const signedContract = await prisma.contract.findFirst({
            where: { dealId: invoice.dealId, status: ContractStatus.SIGNED },
            include: { customer: true },
          });
          if (signedContract?.customer) {
            console.log(`[PAY] Contract SIGNED — triggering onboarding for deal ${invoice.dealId}`);
            await clintEventProcessor.triggerOnboarding(invoice.dealId, signedContract.customer);
          }
        } catch (onboardingErr) {
          console.error("[PAY] Onboarding gate failed (non-blocking):", onboardingErr);
        }
      }
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/api/hub/pay/[id]/charge/route.ts
git commit -m "feat(onboarding): add onboarding gate to invoice payment handler"
```

---

## Task 6: vercel.json + Environment Variables

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add daily clint-sync cron**

In `vercel.json`, add inside the `"crons"` array (as safety-net fallback — webhook is primary):

```json
    {
      "path": "/api/cron/clint-sync",
      "schedule": "0 3 * * *"
    }
```

- [ ] **Step 2: Set environment variables in Vercel**

Run the following (requires Vercel CLI and project linked):

```bash
vercel env add SLACK_BOT_TOKEN
vercel env add SLACK_CHANNEL_COMMERCIAL
vercel env add SLACK_CHANNEL_BASTAO
vercel env add SLACK_CHANNEL_ENGLISH_TEST
vercel env add CLINT_WEBHOOK_SECRET
```

For each, paste the value when prompted. To get the values:
- **SLACK_BOT_TOKEN**: Slack App settings → OAuth & Permissions → Bot User OAuth Token (`xoxb-...`)
- **SLACK_CHANNEL_COMMERCIAL**: Right-click channel in Slack → Copy link → last segment is the Channel ID (`C0...`)
- **SLACK_CHANNEL_BASTAO**: Same as above for #passagem-de-bastao
- **SLACK_CHANNEL_ENGLISH_TEST**: Same for #english-test
- **CLINT_WEBHOOK_SECRET**: Clint webhook settings → signing secret

- [ ] **Step 3: Update .env.example**

Add to `.env.example`:

```bash
# Slack (Bot Token — xoxb-...)
SLACK_BOT_TOKEN=
SLACK_CHANNEL_COMMERCIAL=    # Channel ID (C0...), not channel name
SLACK_CHANNEL_BASTAO=        # Channel ID for #passagem-de-bastao
SLACK_CHANNEL_ENGLISH_TEST=  # Channel ID for #english-test

# Clint Webhook
CLINT_WEBHOOK_SECRET=        # Signing secret from Clint webhook settings
```

- [ ] **Step 4: Commit**

```bash
git add vercel.json .env.example
git commit -m "chore: add daily clint-sync cron + document new env vars"
```

---

## Slack App Setup (one-time, done by operator)

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → Create New App → From scratch
2. Name: "CarreiraHub" → select your workspace
3. Navigate to **OAuth & Permissions** → add Bot Token Scopes: `chat:write`
4. Click **Install to Workspace** → authorize
5. Copy the **Bot User OAuth Token** (`xoxb-...`) → set as `SLACK_BOT_TOKEN`
6. In each Slack channel that should receive notifications, run `/invite @CarreiraHub`
7. Right-click each channel → **Copy link** → extract the Channel ID from the URL → set env vars

---

## Self-Review Checklist

- [x] **Spec coverage:** Fluxo 1 (contact.created) → Task 2+3. Fluxo 2 (stage changed) → Task 2+3. Fluxo 3 (deal won) → Task 2+3. Fluxo 4 (contract+invoice gate) → Task 4+5. Slack service → Task 1. AI feed via metadata → Task 2 (Customer.metadata). cron adjustment → Task 6.
- [x] **Placeholders:** None. All code blocks are complete.
- [x] **Type consistency:** `ClintEventProcessor.triggerOnboarding(dealId: string, customer: {...})` — same signature used in Task 2, Task 4, and Task 5. `slackService` methods match between Task 1 definition and Task 2 calls.
