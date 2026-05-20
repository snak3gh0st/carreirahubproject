import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { summarizeInvoiceHealthSignals } from '@/lib/invoices/invoice-health';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/check-qb-email-status
 * Check if QuickBooks emails are being sent by reviewing IntegrationLog
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

    // Get QB environment
    const config = await prisma.systemConfig.findUnique({
      where: { id: 'system' },
    });

    const now = new Date();

    // Get recent invoice email logs using the current scheduled-send actions.
    const emailLogs = await prisma.integrationLog.findMany({
      where: {
        service: { in: ['quickbooks', 'QUICKBOOKS'] },
        action: {
          in: [
            'scheduled_invoice_sent',
            'scheduled_installment_sent',
            'scheduled_invoice_send_failed',
            'scheduled_invoice_voided_not_found',
            'invoice_email_sent',
            'invoice_email_failed',
          ],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // Get recent invoice creation/sync logs
    const creationLogs = await prisma.integrationLog.findMany({
      where: {
        service: { in: ['quickbooks', 'QUICKBOOKS'] },
        action: {
          in: ['invoice_created_and_sent', 'invoice_synced_on_approval', 'SYNC'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    const invoiceHealthRows = await prisma.invoice.findMany({
      where: {
        status: { notIn: ['PAID', 'VOID'] },
        emailSentAt: null,
        OR: [
          { quickbooks_invoice_id: { not: null } },
          { status: 'DRAFT' },
        ],
      },
      select: {
        status: true,
        dueDate: true,
        emailSentAt: true,
        emailSendAttempts: true,
        quickbooks_invoice_id: true,
        installments: true,
        customer: {
          select: {
            email: true,
          },
        },
      },
    });
    const queueStats = summarizeInvoiceHealthSignals(
      invoiceHealthRows.map((row) => ({
        status: row.status,
        dueDate: row.dueDate,
        emailSentAt: row.emailSentAt,
        emailSendAttempts: row.emailSendAttempts,
        quickbooks_invoice_id: row.quickbooks_invoice_id,
        installments: row.installments,
        customerEmail: row.customer.email,
      })),
      now
    );

    // Count successes and failures
    const emailStats = {
      sent: emailLogs.filter((log) =>
        log.status === 'SUCCESS' &&
        ['scheduled_invoice_sent', 'scheduled_installment_sent', 'invoice_email_sent'].includes(log.action)
      ).length,
      failed: emailLogs.filter((log) =>
        log.status === 'ERROR' &&
        ['scheduled_invoice_send_failed', 'invoice_email_failed'].includes(log.action)
      ).length,
      voidedNotFound: emailLogs.filter((log) => log.action === 'scheduled_invoice_voided_not_found').length,
    };

    // Get recent invoices with QB IDs
    const recentInvoices = await prisma.invoice.findMany({
      where: {
        quickbooks_invoice_id: {
          not: null,
        },
      },
      include: {
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    return NextResponse.json({
      environment: process.env.QUICKBOOKS_ENVIRONMENT || 'sandbox',
      isSandbox: process.env.QUICKBOOKS_ENVIRONMENT !== 'production',
      warning:
        process.env.QUICKBOOKS_ENVIRONMENT !== 'production'
          ? '⚠️ SANDBOX MODE: Emails are NOT actually sent to customers. QuickBooks Sandbox only simulates email sending.'
          : '✓ Production mode: Emails should be sent to customers.',
      emailStats,
      recentEmailLogs: emailLogs.map((log) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        error: log.error,
        payload: log.payload,
        createdAt: log.createdAt,
      })),
      recentCreationLogs: creationLogs.map((log) => ({
        id: log.id,
        action: log.action,
        status: log.status,
        payload: log.payload,
        createdAt: log.createdAt,
      })),
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        qbInvoiceId: inv.quickbooks_invoice_id,
        customerEmail: inv.customer.email,
        amount: inv.amount,
        status: inv.status,
        emailSentAt: inv.emailSentAt,
        emailSendAttempts: inv.emailSendAttempts,
        lastEmailSendError: inv.lastEmailSendError,
        createdAt: inv.createdAt,
      })),
      queueStats,
      instructions: {
        howToVerify: [
          '1. Check emailStats above - if sent > 0, the QuickBooks send endpoint was called successfully',
          '2. queueStats.sendWindowPendingCount shows invoices currently needing publish/send work',
          '3. queueStats.publishWindowPendingCount and queueStats.qbCreatedAwaitingSendCount should usually be informational, not failures',
          '4. queueStats.stalePastDueUnsentCount highlights invoices overdue with no local send recorded',
          '5. If in SANDBOX mode, emails will NOT be sent to real addresses',
        ],
        testEmailSend: [
          '1. Create a new invoice (Finance/Admin role)',
          '2. Check this endpoint again to see if email was logged',
          '3. Or use /api/debug/test-qb-email?invoiceId=<id> to test existing invoice',
        ],
      },
    });
  } catch (error: any) {
    console.error('[DEBUG] Error checking QB email status:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to check email status',
      },
      { status: 500 }
    );
  }
}
