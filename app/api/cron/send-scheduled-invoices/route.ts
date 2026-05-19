import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  DEFAULT_QB_PUBLISH_WINDOW_DAYS,
  getWindowedQuickBooksDeliveryStage,
} from "@/lib/invoices/installment-publishing";
import { extractQuickbooksInvoiceLink } from '@/lib/quickbooks/invoice-link';
import { quickbooksService } from '@/lib/services/quickbooks.service';
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = 'force-dynamic';

/**
 * GET /api/cron/send-scheduled-invoices
 * Send invoice emails when they are 5 days from due date
 *
 * Schedule: Daily at 9:00 AM UTC
 *
 * Logic:
 * - Find all invoices that are QB-synced (quickbooks_invoice_id is set) but NOT yet emailed
 *   (emailSentAt is null) — these are scheduled installments waiting for their send window
 * - Check if dueDate is within 5 days
 * - Send email via QuickBooks /send endpoint and update emailSentAt
 *
 * NOTE: The previous query used `quickbooks_invoice_id: null` which was wrong — all invoices
 * get a QB ID at creation time, so that query always returned 0 results and no emails were sent.
 * The correct signal for "not yet emailed" is emailSentAt being null.
 */
export const GET = withCronTelemetry("send-scheduled-invoices", async (request) => {
  try {
    // Verify cron secret (Vercel cron jobs include this header)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log('[CRON] Unauthorized request to send-scheduled-invoices');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting scheduled invoice sending job...');

    // Find invoices that:
    // 1. Have been synced to QuickBooks (quickbooks_invoice_id is set)
    // 2. Have NOT yet been emailed (emailSentAt is null)
    // 3. Have a customer email to send to
    // MAX_SEND_ATTEMPTS: invoices that have failed this many times are considered
    // "ghost" invoices — their QB ID does not exist in the current QB company (e.g.
    // imported from a sandbox or different QB account during a data migration).
    // Continuing to retry them causes cascading 400 "Object Not Found" errors which
    // trip the circuit breaker and degrade service for all QB operations.
    const MAX_SEND_ATTEMPTS = 5;

    // Clean up invoices already proven to be ghosts by prior QB 610/Object Not Found
    // responses so they do not remain indefinitely in the pending queue.
    const autoVoidedGhostInvoices = await prisma.invoice.updateMany({
      where: {
        quickbooks_invoice_id: { not: null },
        emailSentAt: null,
        status: { notIn: ['PAID', 'VOID'] },
        OR: [
          { lastEmailSendError: { contains: 'Object Not Found' } },
          { lastEmailSendError: { contains: '"code":"610"' } },
          { lastEmailSendError: { contains: '"code": "610"' } },
        ],
      },
      data: {
        status: 'VOID',
      },
    });

    if (autoVoidedGhostInvoices.count > 0) {
      console.log(`[CRON] Auto-voided ${autoVoidedGhostInvoices.count} ghost invoices previously confirmed by QuickBooks as Object Not Found`);
    }

    // Find invoices that need sending: either already in QB (SENT, no email) or
    // DRAFT installments that need to be created in QB first.
    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        emailSentAt: null,
        status: { notIn: ['PAID', 'VOID'] },
        emailSendAttempts: { lt: MAX_SEND_ATTEMPTS },
        OR: [
          { quickbooks_invoice_id: { not: null } }, // Already in QB, just needs email
          { status: 'DRAFT', quickbooks_invoice_id: null }, // DRAFT installment, needs QB creation + email
        ],
      },
      include: {
        customer: true,
        deal: true,
      },
    });

    console.log(`[CRON] Found ${pendingInvoices.length} invoices pending (QB-synced or DRAFT installments)`);

    let sent = 0;
    let skipped = 0;
    let errors = 0;

    const now = new Date();

    for (const invoice of pendingInvoices) {
      try {
        // Skip if customer has no email
        if (!invoice.customer.email) {
          console.log(`[CRON] Skipping invoice ${invoice.id} — customer has no email`);
          skipped++;
          continue;
        }

        // Calculate days until due
        const daysUntilDue = Math.ceil((invoice.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        // Parse installment metadata
        const installmentMeta = invoice.installments as any;
        const isInstallment = !!installmentMeta?.seriesId;

        const publishWindowDays =
          typeof installmentMeta?.qbPublishWindowDays === "number" &&
          installmentMeta.qbPublishWindowDays > 0
            ? installmentMeta.qbPublishWindowDays
            : DEFAULT_QB_PUBLISH_WINDOW_DAYS;
        const deliveryStage = getWindowedQuickBooksDeliveryStage({
          dueDate: invoice.dueDate,
          now,
          publishWindowDays,
        });

        // Only process if within the QB publish window (or already past due)
        if (deliveryStage !== "hold") {
          // If DRAFT with no QB invoice, create it in QB first (7 days before due)
          if (!invoice.quickbooks_invoice_id && invoice.status === 'DRAFT') {
            if (deliveryStage === "create_only") {
              // 7-6 days out: create in QB but don't send email yet
              console.log(`[CRON] Creating QB invoice for DRAFT installment ${invoice.id} (due in ${daysUntilDue} days)`);
              await quickbooksService.initialize();

              const qbCustomer = await quickbooksService.getOrCreateCustomer({
                email: invoice.customer.email,
                name: invoice.customer.name,
                phone: invoice.customer.phone || undefined,
              });

              const lineItems = (invoice.lineItems as any[]) || [];
              const qbInvoice = await quickbooksService.createInvoiceWithBillEmail({
                customerId: qbCustomer.Id,
                customerEmail: invoice.customer.email,
                dueDate: invoice.dueDate,
                docNumber: invoice.invoiceNumber || undefined,
                emailStatus: "NotSet",
                lineItems: lineItems.map((item: any) => ({
                  description: item.description || "Installment",
                  amount: item.amount || Number(invoice.amount),
                  itemRef: item.serviceItemId,
                })),
              });

              await prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                  quickbooks_invoice_id: qbInvoice.Id,
                  ...(extractQuickbooksInvoiceLink(qbInvoice) ? { quickbooks_invoice_link: extractQuickbooksInvoiceLink(qbInvoice) } : {}),
                  status: 'SENT',
                },
              });

              console.log(`[CRON] ✓ DRAFT invoice ${invoice.id} created in QB as ${qbInvoice.Id}`);
              skipped++; // will send email on next run (≤5 days)
              continue;
            }
            // In the send window: create in QB AND send immediately below
            console.log(`[CRON] Creating QB invoice + sending for DRAFT installment ${invoice.id} (due in ${daysUntilDue} days)`);
            await quickbooksService.initialize();

            const qbCustomer = await quickbooksService.getOrCreateCustomer({
              email: invoice.customer.email,
              name: invoice.customer.name,
              phone: invoice.customer.phone || undefined,
            });

            const lineItems = (invoice.lineItems as any[]) || [];
            const qbInvoice = await quickbooksService.createInvoiceWithBillEmail({
              customerId: qbCustomer.Id,
              customerEmail: invoice.customer.email,
              dueDate: invoice.dueDate,
              docNumber: invoice.invoiceNumber || undefined,
              emailStatus: "NeedToSend",
              lineItems: lineItems.map((item: any) => ({
                description: item.description || "Installment",
                amount: item.amount || Number(invoice.amount),
                itemRef: item.serviceItemId,
              })),
            });

            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                quickbooks_invoice_id: qbInvoice.Id,
                ...(extractQuickbooksInvoiceLink(qbInvoice) ? { quickbooks_invoice_link: extractQuickbooksInvoiceLink(qbInvoice) } : {}),
                status: 'SENT',
              },
            });

            // Update local reference for the send step below
            (invoice as any).quickbooks_invoice_id = qbInvoice.Id;
            (invoice as any).quickbooks_invoice_link = extractQuickbooksInvoiceLink(qbInvoice);
            console.log(`[CRON] ✓ DRAFT invoice ${invoice.id} created in QB as ${qbInvoice.Id}, proceeding to send`);
          }

          if (!invoice.quickbooks_invoice_id) {
            console.log(`[CRON] Skipping invoice ${invoice.id} — no QB invoice ID after creation step`);
            skipped++;
            continue;
          }

          if (!/^[0-9]+$/.test(invoice.quickbooks_invoice_id)) {
            console.log(`[CRON] Skipping invoice ${invoice.id} — malformed QB invoice ID ${invoice.quickbooks_invoice_id}`);
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                status: 'VOID',
                lastEmailSendError: 'Malformed QuickBooks invoice ID. Invoice auto-voided from scheduled send queue.',
              },
            });
            errors++;
            continue;
          }

          console.log(`[CRON] Sending email for invoice ${invoice.id} (QB: ${invoice.quickbooks_invoice_id}, due in ${daysUntilDue} days, isInstallment: ${isInstallment})`);

          // Initialize QB service
          await quickbooksService.initialize();

          // Send invoice email via QuickBooks
          const sendResult = await quickbooksService.sendInvoice(
            invoice.quickbooks_invoice_id,
            invoice.customer.email
          );

          if (sendResult.success && sendResult.sent) {
            const deliveredLink = extractQuickbooksInvoiceLink(sendResult.result);

            // Update emailSentAt in our DB to mark as sent
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: {
                emailSentAt: new Date(),
                emailSendAttempts: { increment: 1 },
                lastEmailSendError: null,
                ...(deliveredLink ? { quickbooks_invoice_link: deliveredLink } : {}),
              },
            });

            sent++;

            const action = isInstallment ? 'scheduled_installment_sent' : 'scheduled_invoice_sent';
            await prisma.integrationLog.create({
              data: {
                service: 'quickbooks',
                action,
                status: 'SUCCESS',
                payload: {
                  invoiceId: invoice.id,
                  qbInvoiceId: invoice.quickbooks_invoice_id,
                  recipientEmail: invoice.customer.email,
                  daysUntilDue,
                  sentAt: now,
                  isInstallment,
                  deliveryInfo: sendResult.deliveryInfo,
                  emailStatus: sendResult.emailStatus,
                  sendAttempts: sendResult.attempt,
                } as any,
              },
            });

            console.log(`[CRON] ✓ Email sent for invoice ${invoice.id} to ${invoice.customer.email}`);
          } else {
            // Check if QB returned "Object Not Found" (error code 610).
            // This means the invoice was deleted or voided directly in QuickBooks
            // (e.g. by the finance team) and no longer exists there. Mark the local
            // record as VOID so the cron stops retrying it.
            const isQbObjectNotFound = sendResult.error?.includes('"code":"610"') ||
              sendResult.error?.includes('Object Not Found');

            const invoiceUpdateData: any = {
              emailSendAttempts: { increment: 1 },
              lastEmailSendError: sendResult.error || 'QB send failed',
            };

            if (isQbObjectNotFound) {
              invoiceUpdateData.status = 'VOID';
              console.log(`[CRON] ⚠ Invoice ${invoice.id} (QB: ${invoice.quickbooks_invoice_id}) no longer exists in QuickBooks — marking as VOID`);
            }

            await prisma.invoice.update({
              where: { id: invoice.id },
              data: invoiceUpdateData,
            });

            errors++;

            await prisma.integrationLog.create({
              data: {
                service: 'quickbooks',
                action: isQbObjectNotFound ? 'scheduled_invoice_voided_not_found' : 'scheduled_invoice_send_failed',
                status: 'ERROR',
                error: sendResult.error || 'QB send returned failure',
                payload: {
                  invoiceId: invoice.id,
                  qbInvoiceId: invoice.quickbooks_invoice_id,
                  recipientEmail: invoice.customer.email,
                  daysUntilDue,
                  attempts: sendResult.attempts,
                  emailStatus: sendResult.emailStatus,
                  voidedLocally: isQbObjectNotFound,
                } as any,
              },
            });

            console.log(`[CRON] ✗ Failed to send email for invoice ${invoice.id}: ${sendResult.error}`);
          }
        } else {
          console.log(`[CRON] Skipping invoice ${invoice.id} (due in ${daysUntilDue} days, will send on ${new Date(invoice.dueDate.getTime() - 5 * 24 * 60 * 60 * 1000).toLocaleDateString()})`);
          skipped++;
        }
      } catch (error) {
        console.error(`[CRON] Error sending invoice ${invoice.id}:`, error);
        errors++;

        // Update error tracking
        try {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              emailSendAttempts: { increment: 1 },
              lastEmailSendError: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        } catch (updateError) {
          console.error(`[CRON] Error updating invoice error state:`, updateError);
        }

        await prisma.integrationLog.create({
          data: {
            service: 'quickbooks',
            action: 'scheduled_invoice_send_failed',
            status: 'ERROR',
            error: error instanceof Error ? error.message : 'Unknown error',
            payload: {
              invoiceId: invoice.id,
            } as any,
          },
        });
      }
    }

    console.log(`[CRON] Scheduled invoice sending job complete: ${sent} sent, ${skipped} skipped, ${errors} errors`);

    return NextResponse.json({
      success: true,
      message: 'Scheduled invoice sending job completed',
      sent,
      skipped,
      errors,
      autoVoidedGhostInvoices: autoVoidedGhostInvoices.count,
      total: pendingInvoices.length,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('[CRON] Scheduled invoice sending job failed:', error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
});
