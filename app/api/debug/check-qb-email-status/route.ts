import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';

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

    // Get recent invoice email logs
    const emailLogs = await prisma.integrationLog.findMany({
      where: {
        service: 'quickbooks',
        action: {
          in: ['invoice_email_sent', 'invoice_email_failed'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // Get recent invoice creation logs
    const creationLogs = await prisma.integrationLog.findMany({
      where: {
        service: 'quickbooks',
        action: {
          in: ['invoice_created_and_sent', 'invoice_synced_on_approval'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });

    // Count successes and failures
    const emailStats = {
      sent: emailLogs.filter((log) => log.status === 'SUCCESS').length,
      failed: emailLogs.filter((log) => log.status === 'ERROR').length,
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
        approvalStatus: inv.approvalStatus,
        createdAt: inv.createdAt,
      })),
      instructions: {
        howToVerify: [
          '1. Check emailStats above - if sent > 0, the API call was made',
          '2. If in SANDBOX mode, emails will NOT be sent to real addresses',
          '3. To send real emails, switch to PRODUCTION mode:',
          '   - Set QUICKBOOKS_ENVIRONMENT=production in .env',
          '   - Reconnect OAuth at /api/quickbooks/auth/connect',
          '   - Create a new invoice',
          '4. Check recentEmailLogs for any errors',
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
