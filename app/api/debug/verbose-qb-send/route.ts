import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { quickbooksService, SendInvoiceResult } from '@/lib/services/quickbooks.service';
import { prisma } from '@/lib/db';

/**
 * GET /api/debug/verbose-qb-send?invoiceId=xxx&approach=1
 *
 * Comprehensive debug endpoint that tests multiple approaches to QB invoice sending
 *
 * Approaches:
 * 1 = Standard /send with email in body (current approach)
 * 2 = /send without email (use invoice's BillEmail)
 * 3 = Fetch invoice first, check BillEmail, then send
 * 4 = Update invoice to add BillEmail, then send
 * all = Try all approaches and compare results
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    if (userRole !== 'ADMIN' && userRole !== 'FINANCE') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const invoiceId = searchParams.get('invoiceId');
    const approach = searchParams.get('approach') || '1';

    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Missing invoiceId parameter' },
        { status: 400 }
      );
    }

    // Get invoice from database
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (!invoice.quickbooks_invoice_id) {
      return NextResponse.json(
        { error: 'Invoice not synced to QuickBooks yet' },
        { status: 400 }
      );
    }

    const qbInvoiceId = invoice.quickbooks_invoice_id;
    const customerEmail = invoice.customer.email;

    // Initialize QB service
    await quickbooksService.initialize();

    const results: Record<string, any> = {};
    const conclusions: string[] = [];

    // APPROACH 1: Standard send with email override
    if (approach === '1' || approach === 'all') {
      console.log('[VERBOSE_DEBUG] ========== APPROACH 1: Send with email override ==========');

      if (!customerEmail) {
        results.approach1 = { error: 'Customer has no email address' };
      } else {
        const result = await quickbooksService.sendInvoiceVerbose(qbInvoiceId, customerEmail);
        results.approach1 = result;

        if (result.success) {
          conclusions.push('Approach 1: SUCCESS - Email override method worked');
        } else {
          conclusions.push(`Approach 1: FAILED - ${result.diagnostics.hasFault ? 'QB Fault detected' : 'HTTP error'}`);
        }

        if (result.emailStatus) {
          conclusions.push(`Approach 1: EmailStatus = ${result.emailStatus}`);
        }
      }
    }

    // APPROACH 2: Send without email (rely on invoice's BillEmail)
    if (approach === '2' || approach === 'all') {
      console.log('[VERBOSE_DEBUG] ========== APPROACH 2: Send without email override ==========');

      const result = await quickbooksService.sendInvoiceVerbose(qbInvoiceId);
      results.approach2 = result;

      if (result.success) {
        conclusions.push('Approach 2: SUCCESS - Using invoice BillEmail worked');
      } else {
        conclusions.push(`Approach 2: FAILED - ${result.diagnostics.hasFault ? 'QB Fault detected' : 'HTTP error'}`);
      }

      if (result.emailStatus) {
        conclusions.push(`Approach 2: EmailStatus = ${result.emailStatus}`);
      }
    }

    // APPROACH 3: Fetch invoice first, check state, then send
    if (approach === '3' || approach === 'all') {
      console.log('[VERBOSE_DEBUG] ========== APPROACH 3: Check invoice state before sending ==========');

      try {
        // Fetch invoice details
        const invoiceResponse = await quickbooksService.getInvoice(qbInvoiceId);
        const qbInvoice = invoiceResponse.Invoice;

        const beforeState = {
          invoiceId: qbInvoice.Id,
          billEmail: qbInvoice.BillEmail?.Address,
          emailStatus: qbInvoice.EmailStatus,
          docNumber: qbInvoice.DocNumber,
          syncToken: qbInvoice.SyncToken,
        };

        console.log('[VERBOSE_DEBUG] Invoice state before send:', JSON.stringify(beforeState, null, 2));

        // Now send with email override (if customer has email)
        let sendResult: SendInvoiceResult;
        if (customerEmail) {
          sendResult = await quickbooksService.sendInvoiceVerbose(qbInvoiceId, customerEmail);
        } else {
          sendResult = await quickbooksService.sendInvoiceVerbose(qbInvoiceId);
        }

        results.approach3 = {
          beforeState,
          sendResult,
        };

        if (sendResult.success) {
          conclusions.push('Approach 3: SUCCESS - Send worked after checking state');
          if (beforeState.emailStatus !== sendResult.emailStatus) {
            conclusions.push(`Approach 3: EmailStatus changed from ${beforeState.emailStatus} to ${sendResult.emailStatus}`);
          } else {
            conclusions.push(`Approach 3: WARNING - EmailStatus did NOT change (still ${sendResult.emailStatus})`);
          }
        } else {
          conclusions.push('Approach 3: FAILED - Send failed');
        }
      } catch (error: any) {
        results.approach3 = { error: error.message };
        conclusions.push(`Approach 3: ERROR - ${error.message}`);
      }
    }

    // APPROACH 4: Update invoice with BillEmail BEFORE sending
    if (approach === '4' || approach === 'all') {
      console.log('[VERBOSE_DEBUG] ========== APPROACH 4: Set BillEmail before sending ==========');

      if (!customerEmail) {
        results.approach4 = { error: 'Customer has no email address' };
        conclusions.push('Approach 4: SKIPPED - No customer email');
      } else {
        try {
          // Update invoice to set BillEmail
          console.log(`[VERBOSE_DEBUG] Updating invoice ${qbInvoiceId} BillEmail to ${customerEmail}...`);
          const updatedInvoice = await quickbooksService.updateInvoiceBillEmail(qbInvoiceId, customerEmail);

          const afterUpdate = {
            invoiceId: updatedInvoice.Id,
            billEmail: updatedInvoice.BillEmail?.Address,
            emailStatus: updatedInvoice.EmailStatus,
            syncToken: updatedInvoice.SyncToken,
          };

          console.log('[VERBOSE_DEBUG] Invoice after BillEmail update:', JSON.stringify(afterUpdate, null, 2));

          // Now send without email override (use the BillEmail we just set)
          console.log('[VERBOSE_DEBUG] Sending invoice after BillEmail update...');
          const sendResult = await quickbooksService.sendInvoiceVerbose(qbInvoiceId);

          results.approach4 = {
            afterUpdate,
            sendResult,
          };

          if (sendResult.success) {
            conclusions.push('Approach 4: SUCCESS - Update BillEmail first, then send worked');
            if (afterUpdate.emailStatus !== sendResult.emailStatus) {
              conclusions.push(`Approach 4: EmailStatus changed from ${afterUpdate.emailStatus} to ${sendResult.emailStatus}`);
            } else {
              conclusions.push(`Approach 4: WARNING - EmailStatus did NOT change (still ${sendResult.emailStatus})`);
            }
          } else {
            conclusions.push('Approach 4: FAILED - Send failed even after setting BillEmail');
          }
        } catch (error: any) {
          results.approach4 = { error: error.message, stack: error.stack };
          conclusions.push(`Approach 4: ERROR - ${error.message}`);
        }
      }
    }

    // Determine recommendation
    let recommendation = '';

    if (approach === 'all') {
      const successfulApproaches = [];
      if (results.approach1?.success) successfulApproaches.push('1');
      if (results.approach2?.success) successfulApproaches.push('2');
      if (results.approach3?.sendResult?.success) successfulApproaches.push('3');
      if (results.approach4?.sendResult?.success) successfulApproaches.push('4');

      if (successfulApproaches.length === 0) {
        recommendation = 'None of the approaches worked. Check QB account settings or contact QB support.';
      } else if (successfulApproaches.length === 1) {
        recommendation = `Only approach ${successfulApproaches[0]} worked. Use that method going forward.`;
      } else {
        recommendation = `Approaches ${successfulApproaches.join(', ')} all worked. Recommend approach 1 (simplest).`;
      }
    } else {
      const result = results[`approach${approach}`];
      if (result?.success || result?.sendResult?.success) {
        recommendation = `Approach ${approach} worked! Use this method.`;
      } else {
        recommendation = `Approach ${approach} failed. Try 'all' to test all approaches.`;
      }
    }

    // Log to IntegrationLog
    await prisma.integrationLog.create({
      data: {
        service: 'quickbooks',
        action: 'verbose_qb_send_test',
        status: 'SUCCESS',
        payload: {
          invoiceId: invoice.id,
          qbInvoiceId,
          customerEmail,
          approach,
          results,
          conclusions,
          recommendation,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      invoiceId: invoice.id,
      qbInvoiceId,
      customerEmail,
      qbEnvironment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      approach,
      results,
      conclusions,
      recommendation,
      note: 'Check [QB_SEND_DEBUG] logs in server console for detailed diagnostic output',
    });
  } catch (error: any) {
    console.error('[VERBOSE_DEBUG] Top-level error:', error);

    // Log error
    try {
      await prisma.integrationLog.create({
        data: {
          service: 'quickbooks',
          action: 'verbose_qb_send_test',
          status: 'ERROR',
          error: error.message || 'Unknown error',
          payload: {
            error: error.stack,
          } as any,
        },
      });
    } catch (logError) {
      console.error('[VERBOSE_DEBUG] Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to execute diagnostic test',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
