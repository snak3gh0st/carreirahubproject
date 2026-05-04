/**
 * PCI COMPLIANCE NOTE:
 * - Card data (number, CVC, expiry) transits this server over HTTPS only
 * - Card data is NEVER stored, logged, or persisted
 * - Card data is immediately sent to QB Payments /tokens endpoint
 * - Only the resulting token (non-sensitive) is used after tokenization
 * - For full PCI-DSS compliance, migrate to client-side tokenization when QB offers a JS SDK
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { clintEventProcessor } from "@/lib/services/clint-event-processor.service";
import { ContractStatus, InvoiceStatus } from "@prisma/client";
import { integrationLogger } from "@/lib/utils/logger";
import { getPaymentSecurityHeaders } from "@/lib/hub/security-headers";

export const dynamic = "force-dynamic";

/** PCI-safe fields that are allowed in logs (never card/bank details). */
const SENSITIVE_KEYS = [
  "cardNumber",
  "card_number",
  "cvc",
  "cvv",
  "expMonth",
  "expYear",
  "exp_month",
  "exp_year",
  "accountNumber",
  "account_number",
  "routingNumber",
  "routing_number",
  "number",
];

/** Strip sensitive payment fields from an object before logging. */
function sanitizeForLog(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== "object") return obj;
  if (obj instanceof Error) {
    return { message: obj.message, name: obj.name, stack: obj.stack };
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.includes(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeForLog(value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/** Create a NextResponse.json with payment security headers. */
function secureJson(body: unknown, init?: { status?: number }): NextResponse {
  const headers = getPaymentSecurityHeaders();
  return NextResponse.json(body, { ...init, headers });
}

async function recordLocalPayment(args: {
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  chargeId?: string | null;
  qbPaymentId?: string | null;
  syncedToQb: boolean;
  metadata?: Record<string, unknown>;
}) {
  if (args.qbPaymentId) {
    return prisma.payment.upsert({
      where: { quickbooks_payment_id: args.qbPaymentId },
      create: {
        amount: args.amount,
        currency: "USD",
        paymentDate: new Date(),
        paymentMethod: args.paymentMethod,
        referenceNumber: args.chargeId ?? args.qbPaymentId,
        quickbooks_payment_id: args.qbPaymentId,
        invoiceId: args.invoiceId,
        customerId: args.customerId,
        syncedFromQb: false,
        syncedToQb: args.syncedToQb,
        lastSyncAt: args.syncedToQb ? new Date() : null,
        metadata: args.metadata as any,
      },
      update: {
        amount: args.amount,
        paymentMethod: args.paymentMethod,
        referenceNumber: args.chargeId ?? args.qbPaymentId,
        syncedToQb: args.syncedToQb,
        lastSyncAt: new Date(),
        metadata: args.metadata as any,
      },
    });
  }

  return prisma.payment.create({
    data: {
      amount: args.amount,
      currency: "USD",
      paymentDate: new Date(),
      paymentMethod: args.paymentMethod,
      referenceNumber: args.chargeId ?? undefined,
      invoiceId: args.invoiceId,
      customerId: args.customerId,
      syncedFromQb: false,
      syncedToQb: false,
      metadata: args.metadata as any,
    },
  });
}

/**
 * POST /api/payment-v2/[invoiceId]/charge
 *
 * DRAFT — Custom payment page using QB Payments API.
 * Supports both Card and ACH (bank transfer) payments.
 *
 * Card flow:  tokenize → save card on file → charge → record in QB
 * ACH flow:   tokenize → save bank account → charge eCheck → record in QB
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const { invoiceId } = params;

  try {
    const body = await request.json();
    const paymentMethod = body.paymentMethod || "card";

    // 1. Load invoice + customer
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    });

    if (!invoice) {
      return secureJson({ error: "Fatura não encontrada." }, { status: 404 });
    }
    if (invoice.status === InvoiceStatus.PAID) {
      return secureJson({ error: "Esta fatura já foi paga." }, { status: 409 });
    }
    if (invoice.status !== InvoiceStatus.SENT) {
      return secureJson(
        { error: "Esta fatura não está disponível para pagamento." },
        { status: 400 }
      );
    }

    const qbCustomerId = invoice.customer.quickbooks_id;
    if (!qbCustomerId) {
      return secureJson(
        { error: "Cliente não encontrado no QuickBooks." },
        { status: 400 }
      );
    }

    await quickbooksService.initialize();

    const amount = Number(invoice.amount);
    const description = `Invoice ${invoice.invoiceNumber || invoice.id}`;
    // QB requires requestId <= 50 chars
    const requestId = `pv2-${invoice.id.slice(0, 8)}-${Date.now()}`;

    let chargeResult: any;
    let paymentSaved = false;
    let paymentType: string;

    if (paymentMethod === "card") {
      const result = await processCardPayment(body, qbCustomerId, amount, description, requestId);
      if (result.error) return result.error;
      chargeResult = result.chargeResult;
      paymentSaved = result.paymentSaved;
      paymentType = "card_on_file";
    } else {
      const result = await processAchPayment(body, qbCustomerId, amount, description, requestId);
      if (result.error) return result.error;
      chargeResult = result.chargeResult;
      paymentSaved = result.paymentSaved;
      paymentType = "ach_on_file";
    }

    console.log(`[PAYMENT_V2] ${paymentMethod} charge successful: ${chargeResult?.id}`);

    // Record payment in QB Accounting
    let qbAccountingPaymentId: string | null = null;
    let qbAccountingPaymentError: string | null = null;
    if (invoice.quickbooks_invoice_id) {
      try {
        const qbPayment = await quickbooksService.createPayment({
          customerId: qbCustomerId,
          invoiceId: invoice.quickbooks_invoice_id,
          amount,
          paymentMethod: paymentType,
          referenceNumber: chargeResult?.id || requestId,
          source: "manual",
        });
        qbAccountingPaymentId = qbPayment?.Id ?? null;
      } catch (err: any) {
        qbAccountingPaymentError = err.message ?? String(err);
        console.error("[PAYMENT_V2] QB Accounting payment record failed:", err.message);
      }
    }

    await recordLocalPayment({
      invoiceId: invoice.id,
      customerId: invoice.customerId,
      amount,
      paymentMethod: paymentType,
      chargeId: chargeResult?.id || requestId,
      qbPaymentId: qbAccountingPaymentId,
      syncedToQb: Boolean(qbAccountingPaymentId),
      metadata: {
        source: "payment_v2",
        qbPaymentChargeId: chargeResult?.id || requestId,
        qbAccountingPaymentError,
        paymentSaved,
      },
    });

    // Update local invoice
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        amountPaid: amount,
        paidAt: new Date(),
        paymentMethod: paymentType,
        autoChargePaymentRef: chargeResult?.id || requestId,
        ...(paymentSaved
          ? {
              autoChargeStatus: "CHARGED",
              autoChargeAttempts: 1,
              lastAutoChargeAt: new Date(),
            }
          : {}),
      },
    });

    // Onboarding gate: if contract was already signed, enroll PASS/ADVANCED in Ops.
    if (invoice.dealId) {
      try {
        const signedContract = await prisma.contract.findFirst({
          where: { dealId: invoice.dealId, status: ContractStatus.SIGNED },
          select: { id: true },
        });
        if (signedContract) {
          console.log(`[PAYMENT_V2] Contract SIGNED — triggering onboarding for deal ${invoice.dealId}`);
          await clintEventProcessor.triggerOnboarding(invoice.dealId, invoice.customer);
        }
      } catch (onboardingErr) {
        console.error("[PAYMENT_V2] Onboarding gate failed (non-blocking):", onboardingErr);
      }
    }

    // Update customer balance
    await prisma.customer.update({
      where: { id: invoice.customerId },
      data: {
        qbTotalPaid: { increment: amount },
        qbBalance: { decrement: amount },
        lastQbBalanceSync: new Date(),
      },
    });

    await integrationLogger.logSuccess(
      "quickbooks_payments",
      "payment_v2_charge",
      { invoiceId, chargeId: chargeResult?.id, amount, paymentType, paymentSaved }
    );

    return secureJson({
      success: true,
      chargeId: chargeResult?.id,
      paymentSaved,
      paymentType,
      amount,
    });
  } catch (error: any) {
    // PCI: sanitize before logging to prevent card data leaking into logs
    console.error("[PAYMENT_V2] Unexpected error:", sanitizeForLog(error));
    return secureJson({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}

// ─── Card Payment ───────────────────────────────────────────────

async function processCardPayment(
  body: any,
  qbCustomerId: string,
  amount: number,
  description: string,
  requestId: string
): Promise<{ chargeResult?: any; paymentSaved: boolean; error?: NextResponse }> {
  const { cardNumber, expMonth, expYear, cvc, cardholderName, postalCode } = body;

  if (!cardNumber || !expMonth || !expYear || !cvc || !cardholderName) {
    return { paymentSaved: false, error: secureJson({ error: "Dados do cartão incompletos." }, { status: 400 }) };
  }

  // Tokenize — card data is sent directly to QB and never stored/logged
  let token: string;
  try {
    token = await quickbooksService.tokenizeCard({
      number: cardNumber,
      expMonth,
      expYear,
      cvc,
      name: cardholderName,
      postalCode,
    });
  } catch (err: any) {
    console.error("[PAYMENT_V2] Card tokenization failed:", err.message);
    return {
      paymentSaved: false,
      error: secureJson({ error: "Cartão inválido ou recusado. Verifique os dados." }, { status: 400 }),
    };
  }

  // Save card to customer wallet. createFromToken consumes the token even when
  // the save attempt fails, so fallback charge must use a fresh token.
  let savedCard: any = null;
  try {
    savedCard = await quickbooksService.createCardFromToken(qbCustomerId, token);
    console.log(`[PAYMENT_V2] Card saved: ${savedCard?.id}`);
  } catch (err: any) {
    console.warn("[PAYMENT_V2] Card save failed (fallback to token charge):", err.message);
  }

  // Charge
  try {
    let chargeResult: any;
    if (savedCard?.id) {
      chargeResult = await quickbooksService.chargeCard({ cardId: savedCard.id, amount, description, requestId });
    } else {
      const freshToken = await quickbooksService.tokenizeCard({
        number: cardNumber,
        expMonth,
        expYear,
        cvc,
        name: cardholderName,
        postalCode,
      });
      chargeResult = await quickbooksService.chargeWithToken({ token: freshToken, amount, description, requestId });
    }
    return { chargeResult, paymentSaved: !!savedCard?.id };
  } catch (err: any) {
    console.error("[PAYMENT_V2] Card charge failed:", err.message);
    return {
      paymentSaved: false,
      error: secureJson({ error: "Pagamento recusado. Verifique o cartão ou tente outro método." }, { status: 402 }),
    };
  }
}

// ─── ACH / Bank Transfer Payment ────────────────────────────────

async function processAchPayment(
  body: any,
  qbCustomerId: string,
  amount: number,
  description: string,
  requestId: string
): Promise<{ chargeResult?: any; paymentSaved: boolean; error?: NextResponse }> {
  const { routingNumber, accountNumber, accountName, accountType, phone } = body;

  if (!routingNumber || !accountNumber || !accountName) {
    return {
      paymentSaved: false,
      error: secureJson({ error: "Dados bancários incompletos." }, { status: 400 }),
    };
  }

  // Tokenize bank account — account data is sent directly to QB and never stored/logged
  let token: string;
  try {
    token = await quickbooksService.tokenizeBankAccount({
      routingNumber,
      accountNumber,
      name: accountName,
      accountType: accountType || "PERSONAL_CHECKING",
      phone,
    });
  } catch (err: any) {
    console.error("[PAYMENT_V2] ACH tokenization failed:", err.message);
    return {
      paymentSaved: false,
      error: secureJson({ error: "Dados bancários inválidos. Verifique e tente novamente." }, { status: 400 }),
    };
  }

  // Save bank account to customer. createFromToken consumes the token even when
  // the save attempt fails, so fallback charge must use a fresh token.
  let savedAccount: any = null;
  try {
    savedAccount = await quickbooksService.createBankAccountFromToken(qbCustomerId, token);
    console.log(`[PAYMENT_V2] Bank account saved: ${savedAccount?.id}`);
  } catch (err: any) {
    console.warn("[PAYMENT_V2] Bank account save failed:", err.message);
  }

  // Charge via eCheck
  try {
    let chargeResult: any;
    if (savedAccount?.id) {
      chargeResult = await quickbooksService.chargeBankAccount({
        bankAccountId: savedAccount.id,
        amount,
        description,
        requestId,
      });
    } else {
      const freshToken = await quickbooksService.tokenizeBankAccount({
        routingNumber,
        accountNumber,
        name: accountName,
        accountType: accountType || "PERSONAL_CHECKING",
        phone,
      });
      chargeResult = await quickbooksService.chargeEcheckWithToken({ token: freshToken, amount, description, requestId });
    }
    return { chargeResult, paymentSaved: !!savedAccount?.id };
  } catch (err: any) {
    console.error("[PAYMENT_V2] ACH charge failed:", err.message);
    return {
      paymentSaved: false,
      error: secureJson({ error: "Transferência recusada. Verifique os dados bancários." }, { status: 402 }),
    };
  }
}
