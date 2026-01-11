import twilio from "twilio";

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
  /**
   * Enviar mensagem via WhatsApp
   */
  async sendMessage(to: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    if (!client) {
      console.warn("Twilio client not configured");
      return { success: false, error: "WhatsApp service not configured" };
    }

    try {
      // Garantir formato correto do número (whatsapp:+5511999999999)
      const formattedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

      const result = await client.messages.create({
        from: whatsappNumber,
        to: formattedTo,
        body: message,
      });

      return {
        success: true,
        messageId: result.sid,
      };
    } catch (error) {
      console.error("Error sending WhatsApp message:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
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

