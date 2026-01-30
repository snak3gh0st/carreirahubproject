import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { quickbooksService } from '@/lib/services/quickbooks.service';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug/test-qb-email?invoiceId=xxx
 * Test sending QB invoice via email
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
    const skipEmailOverride = searchParams.get('skipOverride') === 'true';

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

    if (!invoice.customer.email && !skipEmailOverride) {
      return NextResponse.json(
        { error: 'Customer does not have email address' },
        { status: 400 }
      );
    }

    // Initialize QB service
    await quickbooksService.initialize();

    // Fetch QB customer to see their email
    let qbCustomer: any = null;
    if (invoice.customer.quickbooks_id) {
      try {
        qbCustomer = await quickbooksService.getCustomerById(
          invoice.customer.quickbooks_id
        );
        console.log('[DEBUG] QB Customer PrimaryEmailAddr:', qbCustomer.Customer?.PrimaryEmailAddr);
      } catch (error: any) {
        console.error('[DEBUG] Failed to fetch QB customer:', error.message);
      }
    }

    // Fetch invoice to check BillEmail
    let qbInvoice: any = null;
    try {
      qbInvoice = await quickbooksService.getInvoice(invoice.quickbooks_invoice_id);
      console.log('[DEBUG] Invoice BillEmail:', qbInvoice.Invoice?.BillEmail);
    } catch (error: any) {
      console.error('[DEBUG] Failed to fetch QB invoice:', error.message);
    }

    // Send invoice via QB email
    const emailToUse = skipEmailOverride ? undefined : invoice.customer.email;
    console.log(
      `[DEBUG] Testing QB email send for invoice ${invoice.quickbooks_invoice_id}`
    );
    console.log(`[DEBUG] Email mode: ${skipEmailOverride ? 'using QB customer default' : `override to ${emailToUse}`}`);

    const result = await quickbooksService.sendInvoice(
      invoice.quickbooks_invoice_id,
      emailToUse
    );

    console.log('[DEBUG] QB send result:', result);

    // Log to IntegrationLog
    await prisma.integrationLog.create({
      data: {
        service: 'quickbooks',
        action: 'test_invoice_email_send',
        status: 'SUCCESS',
        payload: {
          invoiceId: invoice.id,
          qbInvoiceId: invoice.quickbooks_invoice_id,
          customerEmail: invoice.customer.email,
          skipEmailOverride,
          qbCustomerEmail: qbCustomer?.Customer?.PrimaryEmailAddr?.Address,
          invoiceBillEmail: qbInvoice?.Invoice?.BillEmail?.Address,
          result,
        } as any,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Email send command executed',
      qbInvoiceId: invoice.quickbooks_invoice_id,
      recipientEmail: emailToUse || 'using QB customer default',
      debug: {
        qbCustomerId: qbCustomer?.Customer?.Id,
        qbCustomerEmail: qbCustomer?.Customer?.PrimaryEmailAddr?.Address,
        invoiceBillEmail: qbInvoice?.Invoice?.BillEmail?.Address,
        emailSentTo: emailToUse,
        qbEnvironment: process.env.QUICKBOOKS_ENVIRONMENT,
        skipEmailOverride,
      },
      result,
      note: 'If using QuickBooks Sandbox, emails may not be actually sent. Check QuickBooks UI to verify.',
    });
  } catch (error: any) {
    console.error('[DEBUG] Error testing QB email send:', error);

    // Log error
    try {
      await prisma.integrationLog.create({
        data: {
          service: 'quickbooks',
          action: 'test_invoice_email_send',
          status: 'ERROR',
          error: error.message || 'Unknown error',
          payload: {
            error: error.stack,
          } as any,
        },
      });
    } catch (logError) {
      console.error('[DEBUG] Failed to log error:', logError);
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send email',
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
