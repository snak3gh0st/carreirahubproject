import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

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
    const sevenDaysOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

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

    const [pendingDueSoon, pendingTotal, stalePastDue] = await Promise.all([
      prisma.invoice.count({
        where: {
          quickbooks_invoice_id: { not: null },
          emailSentAt: null,
          status: { notIn: ['PAID', 'VOID'] },
          customer: { email: { not: '' } },
          dueDate: { lte: sevenDaysOut },
        },
      }),
      prisma.invoice.count({
        where: {
          quickbooks_invoice_id: { not: null },
          emailSentAt: null,
          status: { notIn: ['PAID', 'VOID'] },
          customer: { email: { not: '' } },
        },
      }),
      prisma.invoice.count({
        where: {
          quickbooks_invoice_id: { not: null },
          emailSentAt: null,
          emailSendAttempts: 0,
          status: { notIn: ['PAID', 'VOID'] },
          customer: { email: { not: '' } },
          dueDate: { lt: now },
        },
      }),
    ]);

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
      queueStats: {
        pendingDueSoon,
        pendingTotal,
        stalePastDue,
      },
      instructions: {
        howToVerify: [
          '1. Check emailStats above - if sent > 0, the QuickBooks send endpoint was called successfully',
          '2. queueStats.pendingDueSoon shows invoices already inside the send window',
          '3. queueStats.stalePastDue highlights overdue invoices with no send attempt recorded locally',
          '4. If in SANDBOX mode, emails will NOT be sent to real addresses',
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
