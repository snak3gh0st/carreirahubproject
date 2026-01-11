/**
 * RetellAI Service
 *
 * Handles RetellAI API integration for AI-powered collection calls
 * Documentation: https://docs.retellai.com/
 */
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger, StructuredErrorData } from "@/lib/utils/logger";
import { prisma } from "@/lib/db";

export interface RetellCallParams {
  phoneNumber: string;
  customerName: string;
  invoiceNumber: string;
  amountDue: number;
  daysOverdue: number;
  metadata?: Record<string, any>;
}

export interface RetellCallResponse {
  callId: string;
  status: string;
}

export interface RetellCallStatus {
  callId: string;
  status: "registered" | "ongoing" | "ended" | "error";
  startTimestamp?: number;
  endTimestamp?: number;
  disconnectionReason?: string;
  transcript?: string;
  recordingUrl?: string;
  callAnalysis?: {
    callSummary?: string;
    userSentiment?: string;
    callSuccessful?: boolean;
    customAnalysisData?: Record<string, any>;
  };
}

export interface RetellWebhookEvent {
  event: "call_started" | "call_ended" | "call_analyzed";
  call: {
    call_id: string;
    agent_id: string;
    call_status: string;
    start_timestamp?: number;
    end_timestamp?: number;
    transcript?: string;
    recording_url?: string;
    disconnection_reason?: string;
    call_analysis?: {
      call_summary?: string;
      user_sentiment?: string;
      call_successful?: boolean;
      custom_analysis_data?: Record<string, any>;
    };
    metadata?: Record<string, any>;
  };
}

/**
 * RetellAI Service for AI-powered phone calls
 */
export class RetellService {
  private apiKey: string;
  private agentId: string;
  private baseUrl = "https://api.retellai.com";
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.apiKey = process.env.RETELL_API_KEY || "";
    this.agentId = process.env.RETELL_AGENT_ID || "";
    this.circuitBreaker = new CircuitBreaker("retell");
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(this.apiKey && this.agentId);
  }

  /**
   * Make authenticated request to RetellAI API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const startTime = Date.now();
    try {
      return await this.circuitBreaker.execute(async () => {
        if (!this.isConfigured()) {
          const error: any = new Error("RetellAI is not configured. Missing API key or agent ID.");
          error.status = 401;
          throw error;
        }

        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
            ...options.headers,
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          const error: any = new Error(`RetellAI API error: ${response.status}`);
          error.status = response.status;
          error.responseText = errorText;
          throw error;
        }

        return response.json();
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;

      if (error instanceof CircuitOpenError) {
        const structured: StructuredErrorData = {
          errorCode: "CIRCUIT_OPEN",
          category: "transient",
          severity: "error",
          recovery: "wait",
          metadata: {
            endpoint,
            method: options.method || "GET",
          },
        };

        await integrationLogger.logError(
          "retell",
          endpoint,
          error,
          structured,
          { endpoint, method: options.method || "GET" }
        );
        throw error; // Re-throw as the caller handles fallback
      }

      // Log other errors with structured context
      const structured: StructuredErrorData = {
        errorCode: (error as any)?.code || `HTTP_${(error as any)?.status || 500}`,
        category: this.categorizeError(error),
        metadata: {
          statusCode: (error as any)?.status,
          message: (error as any)?.message,
          responseText: (error as any)?.responseText,
        },
      };

      await integrationLogger.logError(
        "retell",
        endpoint,
        error as any,
        structured,
        { endpoint, method: options.method || "GET" },
        0
      );

      throw error;
    }
  }

  private categorizeError(error: any): "transient" | "permanent" | "auth" | "validation" | "unknown" {
    const status = error?.status;
    const message = error?.message || "";

    if (status === 429 || status === 503 || message.includes("timeout")) {
      return "transient";
    }
    if (status === 401 || message.includes("unauthorized")) {
      return "auth";
    }
    if (status === 400) {
      return "validation";
    }
    if (status === 403 || status === 404) {
      return "permanent";
    }
    return "unknown";
  }

  /**
   * Initiate a collection call
   */
  async initiateCall(params: RetellCallParams): Promise<RetellCallResponse> {
    // Format phone number (ensure E.164 format)
    const phoneNumber = this.formatPhoneNumber(params.phoneNumber);

    const response = await this.request<{ call_id: string; status: string }>(
      "/v2/create-phone-call",
      {
        method: "POST",
        body: JSON.stringify({
          agent_id: this.agentId,
          to_number: phoneNumber,
          metadata: {
            customer_name: params.customerName,
            invoice_number: params.invoiceNumber,
            amount_due: params.amountDue,
            days_overdue: params.daysOverdue,
            ...params.metadata,
          },
          // Dynamic variables for the agent script
          retell_llm_dynamic_variables: {
            customer_name: params.customerName,
            invoice_number: params.invoiceNumber,
            amount_due: `R$ ${params.amountDue.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
            })}`,
            days_overdue: params.daysOverdue.toString(),
          },
        }),
      }
    );

    return {
      callId: response.call_id,
      status: response.status,
    };
  }

  /**
   * Get call status and details
   */
  async getCallStatus(callId: string): Promise<RetellCallStatus> {
    const response = await this.request<any>(`/v2/get-call/${callId}`);

    return {
      callId: response.call_id,
      status: response.call_status,
      startTimestamp: response.start_timestamp,
      endTimestamp: response.end_timestamp,
      disconnectionReason: response.disconnection_reason,
      transcript: response.transcript,
      recordingUrl: response.recording_url,
      callAnalysis: response.call_analysis
        ? {
            callSummary: response.call_analysis.call_summary,
            userSentiment: response.call_analysis.user_sentiment,
            callSuccessful: response.call_analysis.call_successful,
            customAnalysisData: response.call_analysis.custom_analysis_data,
          }
        : undefined,
    };
  }

  /**
   * Get call transcript
   */
  async getTranscript(callId: string): Promise<string> {
    const status = await this.getCallStatus(callId);
    return status.transcript || "";
  }

  /**
   * End an active call
   */
  async endCall(callId: string): Promise<void> {
    await this.request(`/v2/end-call/${callId}`, {
      method: "POST",
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signature: string
  ): boolean {
    const webhookSecret = process.env.RETELL_WEBHOOK_SECRET;
    if (!webhookSecret) {
      // If no secret configured, skip verification (not recommended for production)
      console.warn("RETELL_WEBHOOK_SECRET not configured, skipping signature verification");
      return true;
    }

    // RetellAI uses HMAC-SHA256 for webhook signatures
    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    return signature === expectedSignature;
  }

  /**
   * Parse webhook event
   */
  parseWebhookEvent(body: any): RetellWebhookEvent {
    return {
      event: body.event,
      call: {
        call_id: body.call?.call_id,
        agent_id: body.call?.agent_id,
        call_status: body.call?.call_status,
        start_timestamp: body.call?.start_timestamp,
        end_timestamp: body.call?.end_timestamp,
        transcript: body.call?.transcript,
        recording_url: body.call?.recording_url,
        disconnection_reason: body.call?.disconnection_reason,
        call_analysis: body.call?.call_analysis,
        metadata: body.call?.metadata,
      },
    };
  }

  /**
   * Format phone number to E.164 format
   * Assumes Brazilian numbers if no country code
   */
  private formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    let digits = phone.replace(/\D/g, "");

    // If starts with 0, remove it
    if (digits.startsWith("0")) {
      digits = digits.substring(1);
    }

    // If doesn't start with country code, assume Brazil (+55)
    if (!digits.startsWith("55") && digits.length <= 11) {
      digits = "55" + digits;
    }

    // Add + prefix
    return "+" + digits;
  }

  /**
   * List all agents (useful for debugging)
   */
  async listAgents(): Promise<any[]> {
    const response = await this.request<{ agents: any[] }>("/v2/list-agents");
    return response.agents;
  }

  /**
   * Get agent details
   */
  async getAgent(agentId?: string): Promise<any> {
    const id = agentId || this.agentId;
    return this.request(`/v2/get-agent/${id}`);
  }
}

// Export singleton instance
export const retellService = new RetellService();
