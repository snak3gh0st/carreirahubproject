import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { telegramService } from "@/lib/services/telegram.service";
import { clintEventProcessor } from "@/lib/services/clint-event-processor.service";
import { InvoiceStatus, AutoChargeStatus, ContractStatus } from "@prisma/client";
import { integrationLogger } from "@/lib/utils/logger";

export const dynamic = "force-dynamic";

const BATCH_SIZE = 20;

// Set AUTO_CHARGE_DRY_RUN=false in env to enable real charging (Phase 3)
const DRY_RUN = process.env.AUTO_CHARGE_DRY_RUN?.trim() !== "false";

async function recordAutoChargePayment(args: {
  invoiceId: string;
  customerId: string;
  amount: number;
  paymentMethod: string;
  chargeId: string;
  qbPaymentId?: string | null;
}) {
  if (args.qbPaymentId) {
    return prisma.payment.upsert({
      where: { quickbooks_payment_id: args.qbPaymentId },
      create: {
        amount: args.amount,
        currency: "USD",
        paymentDate: new Date(),
        paymentMethod: args.paymentMethod,
        referenceNumber: args.chargeId,
        quickbooks_payment_id: args.qbPaymentId,
        invoiceId: args.invoiceId,
        customerId: args.customerId,
        syncedFromQb: false,
        syncedToQb: true,
        lastSyncAt: new Date(),
        metadata: { source: "auto_charge", qbPaymentChargeId: args.chargeId } as any,
      },
      update: {
        amount: args.amount,
        paymentMethod: args.paymentMethod,
        referenceNumber: args.chargeId,
        syncedToQb: true,
        lastSyncAt: new Date(),
        metadata: { source: "auto_charge", qbPaymentChargeId: args.chargeId } as any,
      },
    });
  }

  return prisma.payment.create({
    data: {
      amount: args.amount,
      currency: "USD",
      paymentDate: new Date(),
      paymentMethod: args.paymentMethod,
      referenceNumber: args.chargeId,
      invoiceId: args.invoiceId,
      customerId: args.customerId,
      syncedFromQb: false,
      syncedToQb: false,
      metadata: { source: "auto_charge", qbPaymentChargeId: args.chargeId } as any,
    },
  });
}

/**
 * GET /api/cron/auto-charge-invoices
 *
 * Daily cron (00:30 UTC) — auto-charges invoices due today if customer
 * has a payment method on file in QuickBooks.
 *
 * DRY_RUN mode (default): logs what WOULD happen without charging.
 * Set AUTO_CHARGE_DRY_RUN=false env var to enable real charging.
 *
 * Runs BEFORE overdue-invoices cron (02:00 UTC) to prevent race conditions.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log(`[CRON] Starting auto-charge-invoices job... (DRY_RUN: ${DRY_RUN})`);

    await quickbooksService.initialize();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Query: invoices due today (first attempt) + retry-pending invoices
    const invoices = await prisma.invoice.findMany({
      where: {
        amount: { gt: 0 },
        OR: [
          // First attempt: due today, SENT status, never attempted
          {
            dueDate: { gte: today, lt: tomorrow },
            status: InvoiceStatus.SENT,
            autoChargeStatus: null,
          },
          // Retries: pending retry, due today or earlier, under 3 attempts
          ...(!DRY_RUN
            ? [
                {
                  autoChargeStatus: AutoChargeStatus.RETRY_PENDING,
                  nextAutoChargeRetry: { lte: tomorrow },
                  autoChargeAttempts: { lt: 3 },
                },
              ]
            : []),
        ],
      },
      include: { customer: true },
      take: BATCH_SIZE,
      orderBy: { dueDate: "asc" },
    });

    console.log(`[CRON] Found ${invoices.length} invoices to auto-charge`);

    let charged = 0;
    let skipped = 0;
    let failed = 0;
    const dryRunLog: any[] = [];

    for (const invoice of invoices) {
      // Declared outside the try so the catch block can still reference it
      // when building the failure email (may be null if the lookup itself
      // was what failed).
      let methods: {
        cards: any[];
        bankAccounts: any[];
        hasPaymentMethod: boolean;
      } | null = null;
      try {
        const qbCustomerId = invoice.customer.quickbooks_id;

        // Skip if no QB customer ID
        if (!qbCustomerId) {
          console.log(
            `[CRON] Skipping invoice ${invoice.id} — no QB customer ID`
          );
          if (!DRY_RUN) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { autoChargeStatus: AutoChargeStatus.SKIPPED },
            });
          }
          skipped++;
          continue;
        }

        // Check for payment methods on file
        methods = await quickbooksService.getCustomerPaymentMethods(qbCustomerId);

        if (!methods.hasPaymentMethod) {
          console.log(
            `[CRON] Skipping invoice ${invoice.id} — no payment method on file`
          );
          if (!DRY_RUN) {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { autoChargeStatus: AutoChargeStatus.SKIPPED },
            });
          }
          skipped++;
          continue;
        }

        // Determine payment method (card > bank account)
        const attemptNumber = invoice.autoChargeAttempts + 1;
        const requestId = `auto-charge-${invoice.id}-${attemptNumber}`;
        const amount = Number(invoice.amount);
        const description = `Invoice ${invoice.invoiceNumber || invoice.id}`;
        const paymentType =
          methods.cards.length > 0 ? "card_on_file" : "ach_on_file";

        // === DRY RUN: log only, don't charge ===
        if (DRY_RUN) {
          const entry = {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customer.name,
            customerEmail: invoice.customer.email,
            qbCustomerId,
            amount,
            paymentType,
            methodId:
              methods.cards.length > 0
                ? methods.cards[0].id
                : methods.bankAccounts[0].id,
            wouldCharge: true,
          };
          dryRunLog.push(entry);
          console.log(
            `[CRON DRY_RUN] WOULD charge invoice ${invoice.invoiceNumber}: $${amount} via ${paymentType} for ${invoice.customer.name}`
          );
          charged++;
          continue;
        }

        // === LIVE MODE: actually charge ===
        let chargeResult: any;

        if (methods.cards.length > 0) {
          const card = methods.cards[0];
          chargeResult = await quickbooksService.chargeCard({
            cardId: card.id,
            amount,
            description,
            requestId,
          });
        } else {
          const bankAccount = methods.bankAccounts[0];
          chargeResult = await quickbooksService.chargeBankAccount({
            bankAccountId: bankAccount.id,
            amount,
            description,
            requestId,
          });
        }

        console.log(
          `[CRON] Charge successful for invoice ${invoice.id}: ${chargeResult?.id}`
        );

        // Create payment in QB Accounting
        const qbInvoiceId = invoice.quickbooks_invoice_id;
        let qbAccountingPaymentId: string | null = null;
        if (qbInvoiceId) {
          const qbPayment = await quickbooksService.createPayment({
            customerId: qbCustomerId,
            invoiceId: qbInvoiceId,
            amount,
            paymentMethod: paymentType,
            referenceNumber: chargeResult?.id || requestId,
            source: "auto_charge",
          });
          qbAccountingPaymentId = qbPayment?.Id ?? null;
        }

        await recordAutoChargePayment({
          invoiceId: invoice.id,
          customerId: invoice.customerId,
          amount,
          paymentMethod: paymentType,
          chargeId: chargeResult?.id || requestId,
          qbPaymentId: qbAccountingPaymentId,
        });

        // Update local invoice
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            amountPaid: amount,
            paidAt: new Date(),
            paymentMethod: paymentType,
            autoChargeStatus: AutoChargeStatus.CHARGED,
            autoChargeAttempts: attemptNumber,
            lastAutoChargeAt: new Date(),
            autoChargePaymentRef: chargeResult?.id || requestId,
          },
        });

        // Onboarding gate: if this autopay completes the purchase and the
        // contract is signed, enroll PASS/ADVANCED in the operational hub.
        if (invoice.dealId) {
          try {
            const signedContract = await prisma.contract.findFirst({
              where: { dealId: invoice.dealId, status: ContractStatus.SIGNED },
              select: { id: true },
            });
            if (signedContract) {
              console.log(`[CRON] Contract SIGNED — triggering onboarding for deal ${invoice.dealId}`);
              await clintEventProcessor.triggerOnboarding(invoice.dealId, invoice.customer);
            }
          } catch (onboardingErr) {
            console.error("[CRON] Onboarding gate failed (non-blocking):", onboardingErr);
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

        // Log success
        await integrationLogger.logSuccess(
          "quickbooks_payments",
          paymentType === "card_on_file"
            ? "auto_charge_card"
            : "auto_charge_ach",
          { invoiceId: invoice.id, chargeId: chargeResult?.id, amount }
        );

        // Email receipt to the customer (best-effort — do not fail the charge).
        if (invoice.customer.email) {
          try {
            const { emailService } = await import("@/lib/services/email.service");
            const methodSource =
              methods.cards.length > 0 ? methods.cards[0] : methods.bankAccounts[0];
            const last4 = (methodSource.number || methodSource.accountNumber || "").slice(-4);
            const brand =
              methods.cards.length > 0
                ? (methodSource.cardType || undefined)
                : (methodSource.bankName || methodSource.name || "Conta bancária");
            await emailService.sendHubAutopayReceipt(
              {
                id: invoice.customer.id,
                email: invoice.customer.email,
                name: invoice.customer.name,
              },
              invoice,
              {
                type: methods.cards.length > 0 ? "card" : "ach",
                last4,
                brand,
              }
            );
          } catch (mailErr: any) {
            console.error(
              `[CRON] Failed to email autopay receipt for invoice ${invoice.id}:`,
              mailErr.message
            );
          }
        }

        charged++;
      } catch (error: any) {
        console.error(
          `[CRON] Auto-charge failed for invoice ${invoice.id}:`,
          error.message
        );

        if (DRY_RUN) {
          failed++;
          continue;
        }

        const attemptNumber = invoice.autoChargeAttempts + 1;
        const isFinalAttempt = attemptNumber >= 3;

        // Calculate next retry date
        let nextRetry: Date | null = null;
        if (!isFinalAttempt) {
          nextRetry = new Date();
          if (attemptNumber === 1) {
            nextRetry.setDate(nextRetry.getDate() + 1);
          } else {
            nextRetry.setDate(nextRetry.getDate() + 2);
          }
        }

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            autoChargeAttempts: attemptNumber,
            lastAutoChargeAt: new Date(),
            lastAutoChargeError: error.message?.slice(0, 500),
            autoChargeStatus: isFinalAttempt
              ? AutoChargeStatus.FAILED
              : AutoChargeStatus.RETRY_PENDING,
            nextAutoChargeRetry: nextRetry,
          },
        });

        await integrationLogger.logError(
          "quickbooks_payments",
          "auto_charge_failed",
          error,
          {
            errorCode: "AUTO_CHARGE_FAILED",
            category: "transient",
            severity: isFinalAttempt ? "error" : "warning",
            recovery: isFinalAttempt ? "manual" : "retry",
            metadata: {
              invoiceId: invoice.id,
              attempt: attemptNumber,
              nextRetry: nextRetry?.toISOString(),
            },
          },
          { invoiceId: invoice.id }
        );

        // Email customer about the failure (best-effort).
        if (invoice.customer.email) {
          try {
            const { emailService } = await import("@/lib/services/email.service");
            // Best-effort method description — may be null if the method
            // lookup itself failed, or the method was deleted mid-attempt.
            const cards = methods?.cards ?? [];
            const banks = methods?.bankAccounts ?? [];
            const hasCard = cards.length > 0;
            const methodSource = hasCard ? cards[0] : banks[0];
            const methodInfo = methodSource
              ? {
                  type: (hasCard ? "card" : "ach") as "card" | "ach",
                  last4: (
                    methodSource.number || methodSource.accountNumber || ""
                  ).slice(-4),
                  brand: hasCard
                    ? methodSource.cardType || undefined
                    : methodSource.bankName ||
                      methodSource.name ||
                      "Conta bancária",
                }
              : { type: "card" as const, last4: "????", brand: undefined };

            await emailService.sendHubAutopayFailed(
              {
                id: invoice.customer.id,
                email: invoice.customer.email,
                name: invoice.customer.name,
              },
              invoice,
              methodInfo,
              nextRetry,
              isFinalAttempt
            );
          } catch (mailErr: any) {
            console.error(
              `[CRON] Failed to email autopay failure for invoice ${invoice.id}:`,
              mailErr.message
            );
          }
        }

        failed++;
      }
    }

    const summary = {
      dryRun: DRY_RUN,
      total: invoices.length,
      charged,
      skipped,
      failed,
      ...(DRY_RUN ? { wouldCharge: dryRunLog } : {}),
    };
    console.log(
      `[CRON] Auto-charge complete:`,
      JSON.stringify(summary, null, 2)
    );

    if (charged > 0 || failed > 0) {
      await telegramService.alertCronSuccess("auto-charge-invoices",
        `${DRY_RUN ? "[DRY RUN] " : ""}Total: ${invoices.length} · Charged: ${charged} · Skipped: ${skipped} · Failed: ${failed}`
      );
    }

    return NextResponse.json(summary);
  } catch (error: any) {
    console.error("[CRON] Auto-charge-invoices job failed:", error);
    await telegramService.alertCronError("auto-charge-invoices", error, {
      Route: request.nextUrl.pathname,
      Method: request.method,
      Duration: `${Date.now() - startTime}ms`,
      DryRun: DRY_RUN,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
