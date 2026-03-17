import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { InvoiceStatus } from "@prisma/client";
import { integrationLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

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
      return NextResponse.json({ error: "Fatura não encontrada." }, { status: 404 });
    }
    if (invoice.status === InvoiceStatus.PAID) {
      return NextResponse.json({ error: "Esta fatura já foi paga." }, { status: 409 });
    }
    if (invoice.status !== InvoiceStatus.SENT) {
      return NextResponse.json(
        { error: "Esta fatura não está disponível para pagamento." },
        { status: 400 }
      );
    }

    const qbCustomerId = invoice.customer.quickbooks_id;
    if (!qbCustomerId) {
      return NextResponse.json(
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
    if (invoice.quickbooks_invoice_id) {
      try {
        await quickbooksService.createPayment({
          customerId: qbCustomerId,
          invoiceId: invoice.quickbooks_invoice_id,
          amount,
          paymentMethod: paymentType,
          referenceNumber: chargeResult?.id || requestId,
          source: "manual",
        });
      } catch (err: any) {
        console.error("[PAYMENT_V2] QB Accounting payment record failed:", err.message);
      }
    }

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

    return NextResponse.json({
      success: true,
      chargeId: chargeResult?.id,
      paymentSaved,
      paymentType,
      amount,
    });
  } catch (error: any) {
    console.error("[PAYMENT_V2] Unexpected error:", error);
    return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 });
  }
}

// ─── Card Payment ───────────────────────────────────────────────

async function processCardPayment(
  body: any,
  qbCustomerId: string,
  amount: number,
  description: string,
  requestId: string
): Promise<{ chargeResult?: any; paymentSaved: boolean; error?: ReturnType<typeof NextResponse.json> }> {
  const { cardNumber, expMonth, expYear, cvc, cardholderName, postalCode } = body;

  if (!cardNumber || !expMonth || !expYear || !cvc || !cardholderName) {
    return { paymentSaved: false, error: NextResponse.json({ error: "Dados do cartão incompletos." }, { status: 400 }) };
  }

  // Tokenize
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
      error: NextResponse.json({ error: "Cartão inválido ou recusado. Verifique os dados." }, { status: 400 }),
    };
  }

  // Save card to customer wallet
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
      chargeResult = await quickbooksService.chargeWithToken({ token, amount, description, requestId });
    }
    return { chargeResult, paymentSaved: !!savedCard?.id };
  } catch (err: any) {
    console.error("[PAYMENT_V2] Card charge failed:", err.message);
    return {
      paymentSaved: false,
      error: NextResponse.json({ error: "Pagamento recusado. Verifique o cartão ou tente outro método." }, { status: 402 }),
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
): Promise<{ chargeResult?: any; paymentSaved: boolean; error?: ReturnType<typeof NextResponse.json> }> {
  const { routingNumber, accountNumber, accountName, accountType, phone } = body;

  if (!routingNumber || !accountNumber || !accountName) {
    return {
      paymentSaved: false,
      error: NextResponse.json({ error: "Dados bancários incompletos." }, { status: 400 }),
    };
  }

  // Tokenize bank account
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
      error: NextResponse.json({ error: "Dados bancários inválidos. Verifique e tente novamente." }, { status: 400 }),
    };
  }

  // Save bank account to customer
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
      // Fallback: charge with token directly
      chargeResult = await quickbooksService.chargeEcheckWithToken({ token, amount, description, requestId });
    }
    return { chargeResult, paymentSaved: !!savedAccount?.id };
  } catch (err: any) {
    console.error("[PAYMENT_V2] ACH charge failed:", err.message);
    return {
      paymentSaved: false,
      error: NextResponse.json({ error: "Transferência recusada. Verifique os dados bancários." }, { status: 402 }),
    };
  }
}
