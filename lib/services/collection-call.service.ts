import { prisma } from "@/lib/db";
import { collectionVoiceService } from "@/lib/services/collection-voice.service";
import {
  COLLECTION_CALL_PROVIDER,
  mapTwilioCallStatus,
} from "@/lib/services/collection-call-voice";
import { resolveAiGatewayModel } from "@/lib/ai/gateway";
import { CollectionCallStatus, CollectionCallOutcome, InvoiceStatus } from "@prisma/client";
import OpenAI from "openai";

let _openai: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return _openai;
}

export interface CollectionCallResult {
  id: string;
  status: CollectionCallStatus;
  externalCallId?: string;
}

export interface CallOutcomeAnalysis {
  outcome: CollectionCallOutcome;
  paymentPromised: boolean;
  promisedDate?: Date;
  notes: string;
}

export interface AutoCallSummary {
  initiated: number;
  skipped: number;
  errors: string[];
}

export interface TwilioCollectionCallStatus {
  collectionCallId: string;
  callSid?: string | null;
  callStatus?: string | null;
  callDuration?: string | null;
}

/**
 * Collection Call Service
 *
 * Orchestrates AI-powered phone calls for overdue invoice collection
 */
export class CollectionCallService {
  private readonly autoDays: number;
  private readonly maxAttempts: number;
  private readonly hoursStart: number;
  private readonly hoursEnd: number;

  constructor() {
    this.autoDays = parseInt(process.env.COLLECTION_CALL_AUTO_DAYS || "3");
    this.maxAttempts = parseInt(process.env.COLLECTION_CALL_MAX_ATTEMPTS || "3");
    this.hoursStart = parseInt(process.env.COLLECTION_CALL_HOURS_START || "9");
    this.hoursEnd = parseInt(process.env.COLLECTION_CALL_HOURS_END || "18");
  }

  isConfigured(): boolean {
    return collectionVoiceService.isConfigured();
  }

  /**
   * Check if within calling hours (Brazil timezone)
   */
  isWithinCallingHours(): boolean {
    // Get current hour in Brazil timezone (UTC-3)
    const now = new Date();
    const brazilOffset = -3 * 60; // -3 hours in minutes
    const brazilTime = new Date(now.getTime() + (brazilOffset + now.getTimezoneOffset()) * 60000);
    const hour = brazilTime.getHours();

    return hour >= this.hoursStart && hour < this.hoursEnd;
  }

  /**
   * Initiate a collection call for an invoice
   */
  async initiateCollectionCall(params: {
    invoiceId: string;
    initiatedBy: string; // User ID or "SYSTEM"
  }): Promise<CollectionCallResult> {
    // Get invoice with customer
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status !== InvoiceStatus.OVERDUE) {
      throw new Error("Invoice is not overdue");
    }

    if (!invoice.customer.phone) {
      throw new Error("Customer has no phone number");
    }

    if (!this.isConfigured()) {
      throw new Error("Collection call service is not configured");
    }

    // Check calling hours for automatic calls
    if (params.initiatedBy === "SYSTEM" && !this.isWithinCallingHours()) {
      throw new Error("Outside of calling hours");
    }

    // Check max attempts
    if (invoice.collectionCallCount >= this.maxAttempts) {
      throw new Error(`Maximum call attempts (${this.maxAttempts}) reached`);
    }

    // Check if called recently (within 24 hours)
    if (invoice.lastCollectionCallAt) {
      const hoursSinceLastCall =
        (Date.now() - invoice.lastCollectionCallAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastCall < 24) {
        throw new Error("Customer was called within the last 24 hours");
      }
    }

    // Create collection call record
    const collectionCall = await prisma.collectionCall.create({
      data: {
        invoiceId: invoice.id,
        customerId: invoice.customerId,
        phoneNumber: invoice.customer.phone,
        provider: COLLECTION_CALL_PROVIDER,
        status: CollectionCallStatus.PENDING,
        initiatedBy: params.initiatedBy,
        scheduledAt: new Date(),
      },
    });

    try {
      const result = await collectionVoiceService.initiateCall({
        collectionCallId: collectionCall.id,
        phoneNumber: invoice.customer.phone,
      });

      // Update collection call with external ID
      const providerStatus = mapTwilioCallStatus(result.status);
      await prisma.collectionCall.update({
        where: { id: collectionCall.id },
        data: {
          externalCallId: result.callId,
          status: providerStatus,
          startedAt: providerStatus === CollectionCallStatus.IN_PROGRESS ? new Date() : undefined,
        },
      });

      // Update invoice tracking
      await prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          lastCollectionCallAt: new Date(),
          collectionCallCount: { increment: 1 },
        },
      });

      // Log the action
      await prisma.integrationLog.create({
        data: {
          service: COLLECTION_CALL_PROVIDER,
          action: "COLLECTION_CALL_INITIATED",
          status: "SUCCESS",
          payload: {
            collectionCallId: collectionCall.id,
            invoiceId: invoice.id,
            customerId: invoice.customerId,
            externalCallId: result.callId,
            initiatedBy: params.initiatedBy,
          } as any,
        },
      });

      return {
        id: collectionCall.id,
        status: providerStatus,
        externalCallId: result.callId,
      };
    } catch (error) {
      // Update collection call with error
      await prisma.collectionCall.update({
        where: { id: collectionCall.id },
        data: {
          status: CollectionCallStatus.FAILED,
          notes: error instanceof Error ? error.message : "Unknown error",
        },
      });

      // Log the error
      await prisma.integrationLog.create({
        data: {
          service: COLLECTION_CALL_PROVIDER,
          action: "COLLECTION_CALL_FAILED",
          status: "ERROR",
          error: error instanceof Error ? error.message : "Unknown error",
          payload: {
            collectionCallId: collectionCall.id,
            invoiceId: invoice.id,
            initiatedBy: params.initiatedBy,
          } as any,
        },
      });

      throw error;
    }
  }

  async handleTwilioStatusCallback(input: TwilioCollectionCallStatus): Promise<void> {
    const status = mapTwilioCallStatus(input.callStatus);
    const duration = input.callDuration ? Number(input.callDuration) : undefined;

    await prisma.collectionCall.update({
      where: { id: input.collectionCallId },
      data: {
        status,
        ...(input.callSid ? { externalCallId: input.callSid } : {}),
        ...(status === CollectionCallStatus.IN_PROGRESS ? { startedAt: new Date() } : {}),
        ...(
          status === CollectionCallStatus.COMPLETED ||
          status === CollectionCallStatus.BUSY ||
          status === CollectionCallStatus.NO_ANSWER ||
          status === CollectionCallStatus.FAILED ||
          status === CollectionCallStatus.CANCELLED
            ? {
                endedAt: new Date(),
                ...(Number.isFinite(duration) ? { duration } : {}),
              }
            : {}
        ),
      },
    });
  }

  async recordAnalyzedTranscript(params: {
    collectionCallId: string;
    transcript: string;
  }): Promise<void> {
    const collectionCallId = params.collectionCallId;

    const collectionCall = await prisma.collectionCall.findUnique({
      where: { id: collectionCallId },
    });

    if (!collectionCall) {
      console.warn(`Collection call not found: ${collectionCallId}`);
      return;
    }

    const transcript = params.transcript || collectionCall.transcript;
    if (transcript) {
      try {
        const analysis = await this.analyzeCallOutcome(transcript);

        await prisma.collectionCall.update({
          where: { id: collectionCallId },
          data: {
            transcript,
            outcome: analysis.outcome,
            paymentPromised: analysis.paymentPromised,
            promisedDate: analysis.promisedDate,
            notes: analysis.notes,
          },
        });

        // If payment was promised, log for follow-up
        if (analysis.paymentPromised) {
          await prisma.integrationLog.create({
            data: {
              service: COLLECTION_CALL_PROVIDER,
              action: "PAYMENT_PROMISED",
              status: "SUCCESS",
              payload: {
                collectionCallId,
                invoiceId: collectionCall.invoiceId,
                promisedDate: analysis.promisedDate?.toISOString(),
                notes: analysis.notes,
              } as any,
            },
          });
        }
      } catch (error) {
        console.error("Error analyzing call outcome:", error);
      }
    }
  }

  /**
   * Process automatic collection calls (called by cron)
   */
  async processAutomaticCalls(): Promise<AutoCallSummary> {
    const summary: AutoCallSummary = {
      initiated: 0,
      skipped: 0,
      errors: [],
    };

    // Check if within calling hours
    if (!this.isWithinCallingHours()) {
      summary.errors.push("Outside of calling hours");
      return summary;
    }

    // Check if service is configured
    if (!this.isConfigured()) {
      summary.errors.push("Collection call service is not configured");
      return summary;
    }

    // Calculate date threshold (N days ago)
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - this.autoDays);

    // Find eligible invoices
    const eligibleInvoices = await prisma.invoice.findMany({
      where: {
        status: InvoiceStatus.OVERDUE,
        markedOverdueAt: { lte: thresholdDate },
        collectionCallCount: { lt: this.maxAttempts },
        OR: [
          { lastCollectionCallAt: null },
          {
            lastCollectionCallAt: {
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // More than 24 hours ago
            },
          },
        ],
        customer: {
          phone: { not: null },
        },
      },
      include: {
        customer: true,
      },
      take: 10, // Process max 10 calls per cron run
    });

    for (const invoice of eligibleInvoices) {
      try {
        await this.initiateCollectionCall({
          invoiceId: invoice.id,
          initiatedBy: "SYSTEM",
        });
        summary.initiated++;
      } catch (error) {
        summary.skipped++;
        summary.errors.push(
          `Invoice ${invoice.invoiceNumber || invoice.id}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    }

    return summary;
  }

  /**
   * Get call history for an invoice
   */
  async getCallHistory(invoiceId: string) {
    return prisma.collectionCall.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Analyze call transcript using AI to determine outcome
   */
  async analyzeCallOutcome(transcript: string): Promise<CallOutcomeAnalysis> {
    if (!process.env.OPENAI_API_KEY) {
      // Default analysis if OpenAI not configured
      return {
        outcome: CollectionCallOutcome.NO_COMMITMENT,
        paymentPromised: false,
        notes: "AI analysis not available",
      };
    }

    try {
      const response = await getOpenAI().chat.completions.create({
        model: resolveAiGatewayModel({ task: "collection_call_analysis" }),
        messages: [
          {
            role: "system",
            content: `You are an AI assistant analyzing collection call transcripts.
Analyze the conversation and determine:
1. The outcome of the call
2. Whether the customer promised to pay
3. If they promised, when they said they would pay
4. A brief summary of the conversation

Respond in JSON format with these fields:
- outcome: one of "PAYMENT_PROMISED", "PAYMENT_MADE", "DISPUTE", "CALLBACK_REQUESTED", "NO_COMMITMENT", "WRONG_NUMBER"
- paymentPromised: boolean
- promisedDate: ISO date string if a date was mentioned (null otherwise)
- notes: brief summary of the call

The transcript is in Portuguese (Brazilian).`,
          },
          {
            role: "user",
            content: `Analyze this collection call transcript:\n\n${transcript}`,
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI");
      }

      const analysis = JSON.parse(content);

      return {
        outcome: analysis.outcome as CollectionCallOutcome,
        paymentPromised: analysis.paymentPromised || false,
        promisedDate: analysis.promisedDate
          ? new Date(analysis.promisedDate)
          : undefined,
        notes: analysis.notes || "",
      };
    } catch (error) {
      console.error("Error analyzing call outcome:", error);
      return {
        outcome: CollectionCallOutcome.NO_COMMITMENT,
        paymentPromised: false,
        notes: `Analysis error: ${error instanceof Error ? error.message : "Unknown"}`,
      };
    }
  }

  /**
   * Cancel a pending or in-progress call
   */
  async cancelCall(collectionCallId: string): Promise<void> {
    const call = await prisma.collectionCall.findUnique({
      where: { id: collectionCallId },
    });

    if (!call) {
      throw new Error("Collection call not found");
    }

    if (
      call.status !== CollectionCallStatus.PENDING &&
      call.status !== CollectionCallStatus.IN_PROGRESS
    ) {
      throw new Error("Call cannot be cancelled");
    }

    // Try to end the call if it's in progress
    if (call.status === CollectionCallStatus.IN_PROGRESS && call.externalCallId) {
      try {
        await collectionVoiceService.endCall(call.externalCallId);
      } catch (error) {
        console.error("Error ending collection call via Twilio:", error);
      }
    }

    await prisma.collectionCall.update({
      where: { id: collectionCallId },
      data: {
        status: CollectionCallStatus.CANCELLED,
        endedAt: new Date(),
      },
    });
  }
}

// Export singleton instance
export const collectionCallService = new CollectionCallService();
