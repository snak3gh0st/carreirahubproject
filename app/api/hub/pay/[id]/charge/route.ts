import { NextRequest, NextResponse } from "next/server";
import { getHubAuth, verifyCsrf } from "@/lib/hub-auth";
import { prisma } from "@/lib/db";
import { InvoiceStatus } from "@prisma/client";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { integrationLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const PAYABLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.SENT,
  InvoiceStatus.OVERDUE,
  InvoiceStatus.PARTIALLY_PAID,
];

/**
 * POST /api/hub/pay/[id]/charge
 * Process a payment for an invoice via QB Payments (card or ACH).
 * Authenticated version for Client Hub users.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ---- Auth ----
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ---- CSRF ----
    if (!verifyCsrf(request)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    // ---- Load invoice ----
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { customer: true },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // ---- Ownership check ----
    if (invoice.customerId !== auth.customerId) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // ---- Status check ----
    if (invoice.status === InvoiceStatus.PAID) {
      return NextResponse.json(
        { error: "Already paid" },
        { status: 409 }
      );
    }

    if (!PAYABLE_STATUSES.includes(invoice.status)) {
      return NextResponse.json(
        { error: "Invoice is not payable in its current status" },
        { status: 400 }
      );
    }

    // ---- Charge amount ----
    const chargeAmount =
      invoice.status === InvoiceStatus.PARTIALLY_PAID
        ? Number(invoice.amount) - Number(invoice.amountPaid)
        : Number(invoice.amount);

    // ---- QB customer ----
    const qbCustomerId = invoice.customer.quickbooks_id;
    if (!qbCustomerId) {
      return NextResponse.json(
        { error: "Customer is not linked to QuickBooks" },
        { status: 400 }
      );
    }

    // ---- Initialize QB ----
    await quickbooksService.initialize();

    // ---- Request ID ----
    const requestId = `pv2-${invoice.id.slice(0, 8)}-${Date.now()}`;

    // ---- Parse body ----
    const body = await request.json();
    const { paymentMethod } = body;

    let chargeResult: any;
    let paymentSaved = false;

    // ----------------------------------------------------------------
    // CARD
    // ----------------------------------------------------------------
    if (paymentMethod === "card") {
      const {
        cardNumber,
        expMonth,
        expYear,
        cvc,
        cardholderName,
        postalCode,
      } = body;

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
        await integrationLogger.logError(
          "hub-payment",
          "tokenize_card",
          err,
          undefined,
          { invoiceId: invoice.id }
        );
        return NextResponse.json(
          { error: "Card tokenization failed. Please check card details." },
          { status: 400 }
        );
      }

      // Try to save card on file
      let savedCard: any = null;
      try {
        savedCard = await quickbooksService.createCardFromToken(
          qbCustomerId,
          token
        );
        paymentSaved = true;
      } catch (err: any) {
        console.warn(
          "[Hub Charge] Could not save card on file, falling back to token charge:",
          err.message
        );
      }

      // Charge
      const description = `Invoice ${invoice.invoiceNumber || invoice.id}`;
      try {
        if (savedCard?.id) {
          chargeResult = await quickbooksService.chargeCard({
            cardId: savedCard.id,
            amount: chargeAmount,
            description,
            requestId,
          });
        } else {
          chargeResult = await quickbooksService.chargeWithToken({
            token,
            amount: chargeAmount,
            description,
            requestId,
          });
        }
      } catch (err: any) {
        await integrationLogger.logError(
          "hub-payment",
          "charge_card",
          err,
          undefined,
          { invoiceId: invoice.id, amount: chargeAmount }
        );
        return NextResponse.json(
          { error: "Payment was declined. Please try a different card." },
          { status: 402 }
        );
      }

    // ----------------------------------------------------------------
    // ACH
    // ----------------------------------------------------------------
    } else if (paymentMethod === "ach") {
      const { routingNumber, accountNumber, accountName, accountType, phone } =
        body;

      // Tokenize
      let token: string;
      try {
        token = await quickbooksService.tokenizeBankAccount({
          routingNumber,
          accountNumber,
          name: accountName,
          accountType,
          phone,
        });
      } catch (err: any) {
        await integrationLogger.logError(
          "hub-payment",
          "tokenize_bank_account",
          err,
          undefined,
          { invoiceId: invoice.id }
        );
        return NextResponse.json(
          {
            error:
              "Bank account verification failed. Please check account details.",
          },
          { status: 400 }
        );
      }

      // Try to save bank account
      let savedAccount: any = null;
      try {
        savedAccount = await quickbooksService.createBankAccountFromToken(
          qbCustomerId,
          token
        );
        paymentSaved = true;
      } catch (err: any) {
        console.warn(
          "[Hub Charge] Could not save bank account, falling back to token charge:",
          err.message
        );
      }

      // Charge
      const description = `Invoice ${invoice.invoiceNumber || invoice.id}`;
      try {
        if (savedAccount?.id) {
          chargeResult = await quickbooksService.chargeBankAccount({
            bankAccountId: savedAccount.id,
            amount: chargeAmount,
            description,
            requestId,
          });
        } else {
          chargeResult = await quickbooksService.chargeEcheckWithToken({
            token,
            amount: chargeAmount,
            description,
            requestId,
          });
        }
      } catch (err: any) {
        await integrationLogger.logError(
          "hub-payment",
          "charge_bank_account",
          err,
          undefined,
          { invoiceId: invoice.id, amount: chargeAmount }
        );
        return NextResponse.json(
          { error: "Bank payment failed. Please try again or use a card." },
          { status: 402 }
        );
      }
    } else {
      return NextResponse.json(
        { error: 'Invalid paymentMethod. Use "card" or "ach".' },
        { status: 400 }
      );
    }

    // ----------------------------------------------------------------
    // Post-charge: create QB Accounting payment
    // ----------------------------------------------------------------
    const chargeId = chargeResult?.id;

    if (invoice.quickbooks_invoice_id) {
      try {
        await quickbooksService.createPayment({
          customerId: qbCustomerId,
          invoiceId: invoice.quickbooks_invoice_id,
          amount: chargeAmount,
          paymentMethod: paymentMethod === "card" ? "CreditCard" : "ECheck",
          referenceNumber: chargeId,
          source: "auto_charge",
        });
      } catch (err: any) {
        // Log but do not fail the request; the charge already succeeded
        await integrationLogger.logError(
          "hub-payment",
          "create_qb_accounting_payment",
          err,
          undefined,
          {
            invoiceId: invoice.id,
            qbInvoiceId: invoice.quickbooks_invoice_id,
            chargeId,
          }
        );
      }
    }

    // ----------------------------------------------------------------
    // Post-charge: update invoice record
    // ----------------------------------------------------------------
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.PAID,
        amountPaid: invoice.amount,
        paidAt: new Date(),
        paymentMethod: paymentMethod === "card" ? "card" : "ach",
        autoChargePaymentRef: chargeId,
      },
    });

    // ----------------------------------------------------------------
    // Post-charge: update customer balance
    // ----------------------------------------------------------------
    await prisma.customer.update({
      where: { id: invoice.customerId },
      data: {
        qbTotalPaid: { increment: chargeAmount },
        qbBalance: { decrement: chargeAmount },
      },
    });

    // ---- Log success ----
    await integrationLogger.logSuccess("hub-payment", "charge_complete", {
      invoiceId: invoice.id,
      chargeId,
      amount: chargeAmount,
      paymentMethod,
      paymentSaved,
    });

    return NextResponse.json({
      success: true,
      chargeId,
      paymentSaved,
      amount: chargeAmount,
    });
  } catch (error: any) {
    console.error("[Hub Charge] Unexpected error:", error);
    await integrationLogger.logError(
      "hub-payment",
      "charge_unexpected_error",
      error,
      undefined,
      { invoiceId: params.id }
    );
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
