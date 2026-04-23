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
type Invoice = { id: string; amount: number | null; invoiceNumber?: string | null };

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

  async notifyPaymentReceived(invoice: Invoice, customer: Customer): Promise<void> {
    const amount = invoice.amount ? `$${Number(invoice.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—";
    const ref = invoice.invoiceNumber ?? invoice.id;
    await this.post(CHANNELS.commercial, [
      {
        type: "header",
        text: { type: "plain_text", text: "💰 Pagamento Recebido" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Cliente:*\n${customer.name ?? customer.email}` },
          { type: "mrkdwn", text: `*Valor:*\n${amount}` },
          { type: "mrkdwn", text: `*Invoice:*\n${ref}` },
          { type: "mrkdwn", text: `*E-mail:*\n${customer.email}` },
        ],
      },
    ], `Pagamento recebido: ${customer.name ?? customer.email} — ${amount}`);
  }

  async notifyEnrollmentPhaseChanged(
    customer: Customer,
    programType: string,
    fromPhaseLabel: string,
    toPhaseLabel: string
  ): Promise<void> {
    await this.post(CHANNELS.bastao, [
      {
        type: "header",
        text: { type: "plain_text", text: "📍 Aluno Avançou de Fase" },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Aluno:*\n${customer.name ?? customer.email}` },
          { type: "mrkdwn", text: `*Programa:*\n${programType}` },
          { type: "mrkdwn", text: `*De:*\n${fromPhaseLabel}` },
          { type: "mrkdwn", text: `*Para:*\n${toPhaseLabel}` },
        ],
      },
    ], `${customer.name ?? customer.email}: ${fromPhaseLabel} → ${toPhaseLabel}`);
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
