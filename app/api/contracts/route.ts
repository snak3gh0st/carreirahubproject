import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ContractStatus } from '@prisma/client';
import { docusignService } from '@/lib/services/docusign.service';

/**
 * GET /api/contracts
 * Fetch contracts with optional filtering
 *
 * Query params:
 * - status: ContractStatus (DRAFT, SENT_FOR_SIGNATURE, VIEWED, SIGNED, DECLINED, VOIDED, EXPIRED)
 * - customerId: Filter by customer
 * - search: Search by customer name or email
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 25)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as ContractStatus | null;
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    // Build where clause
    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { email: { contains: search, mode: 'insensitive' } } },
        { signerName: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.contract.count({ where });

    // Fetch contracts with relations
    const contracts = await prisma.contract.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            amount: true,
          },
        },
        deal: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Calculate status counts for filter badges
    const statusCounts = await prisma.contract.groupBy({
      by: ['status'],
      _count: { status: true },
    });

    const counts = statusCounts.reduce((acc, item) => {
      acc[item.status] = item._count.status;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      contracts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      counts,
    });

  } catch (error) {
    console.error('[API_CONTRACTS] Error fetching contracts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contracts' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts
 * Create a new contract and send to DocuSign
 *
 * Body:
 * - customerId: string (required)
 * - invoiceId: string (optional)
 * - signerName: string (required)
 * - signerEmail: string (required)
 * - expiresInDays: number (default: 30)
 * - templateId: string (optional) - DocuSign template ID. If provided, uses this specific template.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { customerId, invoiceId, signerName, signerEmail, expiresInDays = 30, templateId } = body;

    // Validation
    if (!customerId) {
      return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
    }

    if (!signerName || !signerEmail) {
      return NextResponse.json({ error: 'signerName and signerEmail are required' }, { status: 400 });
    }

    // Fetch customer
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
    });

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Fetch invoice if provided
    let invoice = null;
    if (invoiceId) {
      invoice = await prisma.invoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }
    }

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    // Create or find a "Manual Contracts" deal for contracts created without a deal
    let dealId: string;
    const manualDeal = await prisma.deal.findFirst({
      where: {
        title: 'Manual Contracts',
        customerId,
      },
    });

    if (manualDeal) {
      dealId = manualDeal.id;
    } else {
      // Create a generic deal for this manual contract
      const newDeal = await prisma.deal.create({
        data: {
          title: 'Manual Contracts',
          value: invoice ? parseFloat(invoice.amount.toString()) : 0,
          status: 'WON',
          pipedrive_deal_id: Math.floor(Math.random() * 1000000000), // Temporary ID for manual deals
          customer: {
            connect: { id: customerId },
          },
        },
      });
      dealId = newDeal.id;
    }

    // Create contract in database first (status: DRAFT)
    const contract = await prisma.contract.create({
      data: {
        customer: {
          connect: { id: customerId },
        },
        deal: {
          connect: { id: dealId },
        },
        invoice: invoiceId ? {
          connect: { id: invoiceId },
        } : undefined,
        signerName,
        signerEmail,
        expiresAt,
        status: 'DRAFT',
      },
      include: {
        customer: true,
        invoice: true,
        deal: true,
      },
    });

    try {
      // Send to DocuSign
      let envelopeId: string;
      
      if (templateId) {
        // Use specific template selected by user
        console.log(`[API_CONTRACTS] Creating envelope from selected template: ${templateId}`);
        
        // Build custom fields from invoice data if available
        const customFields: Record<string, string> = {};
        if (invoice) {
          customFields['customer_name'] = customer.name;
          customFields['customer_email'] = customer.email;
          customFields['invoice_number'] = invoice.invoiceNumber || '';
          customFields['invoice_amount'] = `$${parseFloat(invoice.amount.toString()).toFixed(2)}`;
          customFields['invoice_due_date'] = new Date(invoice.dueDate).toLocaleDateString('en-US');
        } else {
          customFields['customer_name'] = customer.name;
          customFields['customer_email'] = customer.email;
        }
        
        envelopeId = await docusignService.createEnvelopeFromSelectedTemplate(
          templateId,
          signerEmail,
          signerName,
          customFields
        );
      } else {
        // Fallback to default template (legacy behavior)
        // Create a minimal invoice object if not provided (for DocuSign template)
        const invoiceForDocuSign = invoice || {
          id: `manual-${contract.id}`,
          invoiceNumber: `MANUAL-${Date.now()}`,
          amount: '0.00',
          dueDate: expiresAt,
          customerId: customer.id,
        } as any;

        // Use invoice-based template creation (DocuSign service requires invoice)
        envelopeId = await docusignService.createEnvelopeFromTemplate(invoiceForDocuSign, customer);
      }

      // Update contract with DocuSign envelope ID and status
      const updatedContract = await prisma.contract.update({
        where: { id: contract.id },
        data: {
          docusign_env_id: envelopeId,
          status: 'SENT_FOR_SIGNATURE',
          sentAt: new Date(),
        },
        include: {
          customer: true,
          invoice: true,
        },
      });

      // Log integration event
      await prisma.integrationLog.create({
        data: {
          service: 'DOCUSIGN',
          action: 'CREATE_ENVELOPE',
          status: 'SUCCESS',
          payload: {
            customerId,
            invoiceId,
            contractId: contract.id,
            envelopeId,
          },
        },
      });

      return NextResponse.json({
        contract: updatedContract,
        envelopeId,
        message: 'Contract created and sent to DocuSign successfully',
      });

    } catch (docusignError) {
      // DocuSign failed - update contract status to DRAFT and log error
      console.error('[API_CONTRACTS] DocuSign error:', docusignError);

      await prisma.integrationLog.create({
        data: {
          service: 'DOCUSIGN',
          action: 'CREATE_ENVELOPE',
          status: 'ERROR',
          payload: {
            customerId,
            invoiceId,
            contractId: contract.id,
          },
          error: docusignError instanceof Error ? docusignError.message : 'Unknown error',
        },
      });

      // Contract stays in DRAFT status - user can retry from detail page
      return NextResponse.json(
        {
          error: 'Failed to send contract to DocuSign. Contract saved as draft.',
          contract,
          details: docusignError instanceof Error ? docusignError.message : 'Unknown error',
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('[API_CONTRACTS] Error creating contract:', error);
    return NextResponse.json(
      {
        error: 'Failed to create contract',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
