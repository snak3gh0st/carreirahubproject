import twilio from "twilio";
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger, StructuredErrorData } from "@/lib/utils/logger";
import { prisma } from "@/lib/db";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER;

const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

/**
 * WhatsApp Service
 *
 * Responsabilidade: Enviar mensagens via WhatsApp Business API (Twilio)
 */
export class WhatsAppService {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker("whatsapp");
  }

  /**
   * Enviar mensagem via WhatsApp
   */
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!client) {
      console.warn("Twilio client not configured");
      const structured: StructuredErrorData = {
        errorCode: "CLIENT_NOT_CONFIGURED",
        category: "auth",
        severity: "error",
        recovery: "check_circuit",
        metadata: { to, messageLength: message.length },
      };
      await integrationLogger.logError(
        "whatsapp",
        "sendMessage",
        "Twilio client not configured",
        structured,
        { to, messageLength: message.length }
      );
      return { success: false, error: "WhatsApp service not configured" };
    }

    const startTime = Date.now();
    try {
      // Garantir formato correto do número (whatsapp:+5511999999999)
      const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

      const result = await this.circuitBreaker.execute(async () => {
        return await client.messages.create({
          from: whatsappNumber,
          to: formattedTo,
          body: message,
        });
      });

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof CircuitOpenError) {
        const structured: StructuredErrorData = {
          errorCode: "CIRCUIT_OPEN",
          category: "transient",
          severity: "error",
          recovery: "wait",
          metadata: { to, messageLength: message.length },
        };

        await integrationLogger.logError(
          "whatsapp",
          "sendMessage",
          error,
          structured,
          { to, messageLength: message.length }
        );
        return { success: false, error: "WhatsApp service temporarily unavailable, message queued for retry" };
      }

      // Log other errors
      const structured: StructuredErrorData = {
        errorCode: (error as any)?.code || "UNKNOWN_ERROR",
        category: this.categorizeError(error),
        metadata: {
          message: (error as any)?.message,
          to,
          messageLength: message.length,
        },
      };

      await integrationLogger.logError(
        "whatsapp",
        "sendMessage",
        error as any,
        structured,
        { to, messageLength: message.length }
      );

      console.error("Error sending WhatsApp message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private categorizeError(error: any): "transient" | "permanent" | "auth" | "validation" | "unknown" {
    const message = error?.message || "";

    if (message.includes("timeout") || message.includes("temporarily unavailable")) {
      return "transient";
    }
    if (message.includes("unauthorized") || message.includes("authentication")) {
      return "auth";
    }
    if (message.includes("invalid") || message.includes("malformed")) {
      return "validation";
    }
    return "unknown";
  }

  /**
   * Enviar mensagem de boas-vindas
   */
  async sendWelcomeMessage(phone: string, name: string): Promise<void> {
    const message = `Olá ${name}! 👋

Bem-vindo(a) à Carreira U.S.A!

Obrigado pelo seu interesse em nossa plataforma. Nossa equipe está aqui para ajudar você a alcançar seus objetivos nos Estados Unidos.

Como posso ajudá-lo(a) hoje?`;

    await this.sendMessage(phone, message);
  }

  /**
   * Enviar mensagem de qualificação
   */
  async sendQualificationMessage(phone: string, name: string): Promise<void> {
    const message = `Olá ${name}! 🎉

Parabéns! Você foi qualificado(a) para nosso programa de carreiras nos EUA.

Nossa equipe entrará em contato em breve para apresentar as próximas etapas.

Qualquer dúvida, estamos à disposição!`;

    await this.sendMessage(phone, message);
  }
}

export const whatsappService = new WhatsAppService();
