import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { buildTelegramErrorMessage } from "@/lib/utils/telegram-alerts";

const API = "https://api.telegram.org";

export class TelegramService {
  private token: string;
  private chatId: string;
  private cb: CircuitBreaker;

  constructor() {
    this.token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    this.chatId = process.env.TELEGRAM_CHAT_ID ?? "";
    this.cb = new CircuitBreaker("telegram", {
      thresholdFailures: 3,
      timeoutMs: 120_000,
    });
  }

  private get configured(): boolean {
    return Boolean(this.token && this.chatId);
  }

  async send(text: string, opts?: { parse_mode?: "HTML" | "MarkdownV2" }): Promise<void> {
    if (!this.configured) return;

    try {
      await this.cb.execute(async () => {
        const res = await fetch(`${API}/bot${this.token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: this.chatId,
            text,
            parse_mode: opts?.parse_mode ?? "HTML",
            disable_web_page_preview: true,
          }),
        });
        const data = (await res.json()) as { ok: boolean; description?: string };
        if (!data.ok) throw new Error(`Telegram API: ${data.description}`);
      });
    } catch (err) {
      if (err instanceof CircuitOpenError) return;
      console.error("[Telegram] Failed to send:", (err as Error).message);
    }
  }

  // ---------------------------------------------------------------------------
  // Errors
  // ---------------------------------------------------------------------------

  async alertError(context: string, error: unknown, extra?: Record<string, unknown>): Promise<void> {
    await this.send(buildTelegramErrorMessage(context, error, extra));
  }

  async alertWebhookError(
    service: string,
    action: string,
    error: unknown,
    extra?: Record<string, unknown>
  ): Promise<void> {
    await this.alertError(`Webhook ${service}/${action}`, error, {
      Service: service,
      Action: action,
      ...extra,
    });
  }

  async alertCronError(cronName: string, error: unknown, extra?: Record<string, unknown>): Promise<void> {
    await this.alertError(`Cron ${cronName}`, error, extra);
  }

  async alertPaymentError(
    invoiceId: string,
    customerName: string,
    error: unknown,
    extra?: Record<string, unknown>
  ): Promise<void> {
    await this.alertError("Payment Failed", error, {
      Invoice: invoiceId,
      Customer: customerName,
      ...extra,
    });
  }

  async alertIntegrationError(service: string, error: unknown, extra?: Record<string, unknown>): Promise<void> {
    await this.alertError(`Integration ${service}`, error, extra);
  }

  // ---------------------------------------------------------------------------
  // Cron reports
  // ---------------------------------------------------------------------------

  async alertCronSuccess(cronName: string, summary: string): Promise<void> {
    await this.send(
      [`✅ <b>CRON</b> — ${esc(cronName)}`, "", esc(summary), `<i>${new Date().toISOString()}</i>`].join("\n")
    );
  }

  async alertCronSkipped(cronName: string, reason: string): Promise<void> {
    await this.send(
      [`⏭️ <b>CRON SKIP</b> — ${esc(cronName)}`, "", esc(reason), `<i>${new Date().toISOString()}</i>`].join("\n")
    );
  }

  // ---------------------------------------------------------------------------
  // Sync reports
  // ---------------------------------------------------------------------------

  async alertSyncComplete(service: string, stats: Record<string, number | string>): Promise<void> {
    const lines = Object.entries(stats).map(([k, v]) => `  ${esc(k)}: <b>${esc(String(v))}</b>`);
    await this.send(
      [
        `🔄 <b>SYNC</b> — ${esc(service)}`,
        "",
        ...lines,
        "",
        `<i>${new Date().toISOString()}</i>`,
      ].join("\n")
    );
  }

  async alertSyncError(service: string, error: unknown, extra?: Record<string, unknown>): Promise<void> {
    await this.alertError(`Sync ${service}`, error, extra);
  }

  // ---------------------------------------------------------------------------
  // Warnings & info
  // ---------------------------------------------------------------------------

  async alertWarning(context: string, message: string): Promise<void> {
    await this.send(
      [`⚠️ <b>WARNING</b> — ${esc(context)}`, "", esc(message), `<i>${new Date().toISOString()}</i>`].join("\n")
    );
  }

  async alertInfo(context: string, message: string): Promise<void> {
    await this.send(
      [`ℹ️ <b>INFO</b> — ${esc(context)}`, "", esc(message), `<i>${new Date().toISOString()}</i>`].join("\n")
    );
  }

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  async ping(): Promise<boolean> {
    if (!this.configured) return false;
    try {
      const res = await fetch(`${API}/bot${this.token}/getMe`);
      const data = (await res.json()) as { ok: boolean };
      return data.ok;
    } catch {
      return false;
    }
  }
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const telegramService = new TelegramService();
