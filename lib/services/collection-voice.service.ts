import twilio from "twilio";
import {
  buildCollectionCallStatusCallbackUrl,
  buildCollectionCallTwimlUrl,
  getCollectionCallPublicBaseUrl,
  isCollectionVoiceConfigured,
  normalizeCollectionPhoneNumber,
} from "@/lib/services/collection-call-voice";
import { CircuitBreaker, CircuitOpenError } from "@/lib/utils/circuit-breaker";
import { integrationLogger, StructuredErrorData } from "@/lib/utils/logger";

export interface CollectionVoiceCallParams {
  collectionCallId: string;
  phoneNumber: string;
}

export interface CollectionVoiceCallResponse {
  callId: string;
  status: string;
}

export class CollectionVoiceService {
  private circuitBreaker = new CircuitBreaker("collection-voice");

  isConfigured(): boolean {
    return isCollectionVoiceConfigured();
  }

  async initiateCall(params: CollectionVoiceCallParams): Promise<CollectionVoiceCallResponse> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    const baseUrl = getCollectionCallPublicBaseUrl();

    if (!accountSid || !authToken || !from || !baseUrl || !this.isConfigured()) {
      const error: any = new Error("Collection voice service is not configured.");
      error.status = 401;
      throw error;
    }

    const client = twilio(accountSid, authToken);
    const to = normalizeCollectionPhoneNumber(params.phoneNumber);
    const twimlUrl = buildCollectionCallTwimlUrl(baseUrl, params.collectionCallId);
    const statusCallback = buildCollectionCallStatusCallbackUrl(baseUrl, params.collectionCallId);

    try {
      const call = await this.circuitBreaker.execute(async () => {
        return client.calls.create({
          from,
          to,
          url: twimlUrl,
          method: "POST",
          statusCallback,
          statusCallbackMethod: "POST",
          statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
        });
      });

      return {
        callId: call.sid,
        status: call.status,
      };
    } catch (error) {
      const structured: StructuredErrorData = {
        errorCode: error instanceof CircuitOpenError ? "CIRCUIT_OPEN" : (error as any)?.code || "TWILIO_CALL_FAILED",
        category: this.categorizeError(error),
        metadata: {
          to,
          collectionCallId: params.collectionCallId,
          message: error instanceof Error ? error.message : String(error),
        },
      };

      await integrationLogger.logError(
        "collection-voice",
        "initiateCall",
        error as any,
        structured,
        { to, collectionCallId: params.collectionCallId }
      );
      throw error;
    }
  }

  async endCall(callSid: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error("Twilio is not configured.");
    }

    const client = twilio(accountSid, authToken);
    await client.calls(callSid).update({ status: "completed" });
  }

  private categorizeError(error: unknown): "transient" | "permanent" | "auth" | "validation" | "unknown" {
    if (error instanceof CircuitOpenError) return "transient";

    const status = (error as any)?.status;
    const code = String((error as any)?.code || "");
    const message = String((error as any)?.message || "").toLowerCase();

    if (status === 429 || status === 503 || message.includes("timeout")) return "transient";
    if (status === 401 || code.startsWith("20") || message.includes("authenticate")) return "auth";
    if (status === 400 || message.includes("invalid")) return "validation";
    if (status === 403 || status === 404) return "permanent";
    return "unknown";
  }
}

export const collectionVoiceService = new CollectionVoiceService();
