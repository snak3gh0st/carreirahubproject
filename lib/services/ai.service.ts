import OpenAI from "openai";
import { CUSTOMER_SERVICE_SYSTEM_PROMPT, CUSTOMER_SERVICE_USER_CONTEXT } from "@/lib/prompts/customer-service";
import { LEAD_QUALIFICATION_PROMPT, LEAD_QUALIFICATION_DATA_FORMAT } from "@/lib/prompts/lead-qualification";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const AI_MODEL = process.env.AI_MODEL || "gpt-4-turbo-preview";
const AI_TEMPERATURE = parseFloat(process.env.AI_TEMPERATURE || "0.7");

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatResponse {
  response: string;
  shouldEscalate: boolean;
  intent?: string;
  sentiment?: "positive" | "neutral" | "negative";
}

export interface QualificationResult {
  score: number;
  criteria: {
    interest: number;
    budget: number;
    timeline: number;
    motivation: number;
    profile: number;
  };
  summary: string;
  recommendations: string[];
}

export class AIService {
  /**
   * Processa mensagem do lead no chatbot e retorna resposta contextual
   */
  async chatWithLead(
    message: string,
    leadContext: {
      name: string;
      email: string;
      conversationHistory: ChatMessage[];
    }
  ): Promise<ChatResponse> {
    try {
      // Verificar se API key está configurada
      if (!process.env.OPENAI_API_KEY) {
        console.warn("[AI] OPENAI_API_KEY not configured, returning default response");
        return {
          response: "Desculpe, nosso sistema de chat está temporariamente indisponível. Por favor, entre em contato conosco por email ou telefone.",
          shouldEscalate: true,
          intent: "support_needed",
          sentiment: "neutral",
        };
      }

      const systemPrompt = CUSTOMER_SERVICE_SYSTEM_PROMPT;
      const userContext = CUSTOMER_SERVICE_USER_CONTEXT(
        leadContext.name,
        leadContext.email,
        this.formatConversationHistory(leadContext.conversationHistory)
      );

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: systemPrompt },
        { role: "system", content: userContext },
        ...leadContext.conversationHistory.map((msg) => ({
          role: msg.role,
          content: msg.content,
        })) as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
        { role: "user", content: message },
      ];

      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages,
        temperature: AI_TEMPERATURE,
        max_tokens: 500,
      });

      const response = completion.choices[0]?.message?.content || "Desculpe, não consegui processar sua mensagem.";

      // Analisar se deve escalar
      const shouldEscalate = await this.shouldEscalate(message, response, leadContext.conversationHistory);
      
      // Extrair intenção
      const intent = await this.extractIntent(message);

      return {
        response,
        shouldEscalate,
        intent,
        sentiment: this.analyzeSentiment(message),
      };
    } catch (error: any) {
      console.error("Error in chatWithLead:", error);
      
      // Se for erro de autenticação, retornar resposta padrão
      if (error?.status === 401 || error?.message?.includes("API key")) {
        console.warn("[AI] OpenAI API key invalid or missing");
        return {
          response: "Desculpe, nosso sistema de chat está temporariamente indisponível. Por favor, entre em contato conosco por email ou telefone.",
          shouldEscalate: true,
          intent: "support_needed",
          sentiment: "neutral",
        };
      }
      
      throw new Error("Failed to process chat message");
    }
  }

  /**
   * Qualifica lead baseado em dados e histórico de conversas
   */
  async qualifyLead(
    leadData: {
      name: string;
      email: string;
      phone?: string;
      source: string;
      conversationHistory?: ChatMessage[];
      metadata?: any;
    }
  ): Promise<QualificationResult> {
    try {
      // Verificar se API key está configurada
      if (!process.env.OPENAI_API_KEY) {
        console.warn("[AI] OPENAI_API_KEY not configured, returning default qualification");
        return {
          score: 50, // Score médio quando não há API
          criteria: {
            interest: 50,
            budget: 50,
            timeline: 50,
            motivation: 50,
            profile: 50,
          },
          summary: "Qualificação automática não disponível (API key não configurada)",
          recommendations: ["Configure OPENAI_API_KEY no .env para habilitar qualificação automática"],
        };
      }

      const conversationHistory = this.formatConversationHistory(leadData.conversationHistory || []);
      const dataFormat = LEAD_QUALIFICATION_DATA_FORMAT({
        ...leadData,
        conversationHistory,
      });

      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: "system", content: LEAD_QUALIFICATION_PROMPT },
        { role: "user", content: dataFormat },
      ];

      const completion = await openai.chat.completions.create({
        model: AI_MODEL,
        messages,
        temperature: 0.3, // Lower temperature for more consistent scoring
        response_format: { type: "json_object" },
      });

      const responseContent = completion.choices[0]?.message?.content || "{}";
      const result = JSON.parse(responseContent) as QualificationResult;

      // Validar e normalizar score
      result.score = Math.max(0, Math.min(100, result.score || 0));

      return result;
    } catch (error: any) {
      console.error("Error in qualifyLead:", error);
      
      // Se for erro de autenticação, retornar score padrão
      if (error?.status === 401 || error?.message?.includes("API key")) {
        console.warn("[AI] OpenAI API key invalid or missing");
        return {
          score: 50,
          criteria: {
            interest: 50,
            budget: 50,
            timeline: 50,
            motivation: 50,
            profile: 50,
          },
          summary: "Qualificação automática não disponível (API key inválida ou ausente)",
          recommendations: ["Configure OPENAI_API_KEY no .env"],
        };
      }
      
      // Retornar resultado padrão em caso de erro
      return {
        score: 0,
        criteria: {
          interest: 0,
          budget: 0,
          timeline: 0,
          motivation: 0,
          profile: 0,
        },
        summary: "Erro ao qualificar lead",
        recommendations: ["Revisar manualmente"],
      };
    }
  }

  /**
   * Extrai intenção da mensagem
   */
  async extractIntent(message: string): Promise<string> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "Analise a mensagem e retorne apenas uma palavra: 'dúvida', 'interesse', 'objeção', 'informação', ou 'outro'",
          },
          { role: "user", content: message },
        ],
        temperature: 0.1,
        max_tokens: 10,
      });

      return completion.choices[0]?.message?.content?.toLowerCase().trim() || "outro";
    } catch (error) {
      console.error("Error extracting intent:", error);
      return "outro";
    }
  }

  /**
   * Decide se conversa deve ser escalada para humano
   */
  async shouldEscalate(
    message: string,
    response: string,
    conversationHistory: ChatMessage[]
  ): Promise<boolean> {
    // Regras simples para escalação
    const escalationKeywords = [
      "falar com alguém",
      "falar com vendedor",
      "falar com consultor",
      "quero comprar",
      "quero contratar",
      "quanto custa",
      "preço",
      "valor",
      "objeção",
      "não tenho dinheiro",
      "muito caro",
    ];

    const messageLower = message.toLowerCase();
    const hasEscalationKeyword = escalationKeywords.some((keyword) =>
      messageLower.includes(keyword)
    );

    // Se tem muitas mensagens (conversa longa), pode precisar de humano
    const isLongConversation = conversationHistory.length > 10;

    // Se lead pediu explicitamente
    const explicitRequest = messageLower.includes("falar com") || messageLower.includes("contato");

    return hasEscalationKeyword || isLongConversation || explicitRequest;
  }

  /**
   * Analisa sentimento da mensagem (simplificado)
   */
  private analyzeSentiment(message: string): "positive" | "neutral" | "negative" {
    const positiveWords = ["sim", "quero", "interessado", "gostei", "ótimo", "perfeito"];
    const negativeWords = ["não", "caro", "difícil", "complicado", "não tenho", "impossível"];

    const messageLower = message.toLowerCase();
    const positiveCount = positiveWords.filter((word) => messageLower.includes(word)).length;
    const negativeCount = negativeWords.filter((word) => messageLower.includes(word)).length;

    if (positiveCount > negativeCount) return "positive";
    if (negativeCount > positiveCount) return "negative";
    return "neutral";
  }

  /**
   * Formata histórico de conversas para contexto
   */
  private formatConversationHistory(history: ChatMessage[]): string {
    if (history.length === 0) return "Nenhuma conversa anterior.";

    return history
      .map((msg, index) => {
        const role = msg.role === "user" ? "Lead" : "Assistente";
        return `${role}: ${msg.content}`;
      })
      .join("\n\n");
  }
}

export const aiService = new AIService();

