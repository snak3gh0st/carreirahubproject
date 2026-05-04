import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ContractStatus } from '@prisma/client';
import { docusignService, validateCustomerForContract } from '@/lib/services/docusign.service';

export const dynamic = 'force-dynamic';

const PROGRAM_LABEL_MAP: Record<string, string> = {
  pass_advanced: 'Pass Advanced',
  pass: 'Pass',
  combo: 'Combo',
  start: 'Start',
  avulso: 'Avulso',
  upgrade: 'Upgrade',
  new_pass: 'New Pass',
  treinamento: 'Treinamento',
  early_career: 'Early Career',
};

function getPreferredCustomerIdentification(customer: {
  ssn?: string | null;
  cpf?: string | null;
  passport?: string | null;
}): string {
  return customer.ssn || customer.cpf || customer.passport || '';
}

function getInvoiceServiceDescription(
  invoice: { lineItems?: unknown } | null,
  program?: string | null
): string {
  if (invoice && Array.isArray(invoice.lineItems)) {
    const firstLineItem = invoice.lineItems[0];
    if (
      firstLineItem &&
      typeof firstLineItem === 'object' &&
      'description' in firstLineItem &&
      typeof firstLineItem.description === 'string' &&
      firstLineItem.description.trim() !== ''
    ) {
      return firstLineItem.description;
    }
  }

  if (program && PROGRAM_LABEL_MAP[program]) {
    return PROGRAM_LABEL_MAP[program];
  }

  return 'Professional Services';
}

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
    const userRole = (session.user as any).role;
    const userId = (session.user as any).id as string;
    const allowedRoles = ['ADMIN', 'FINANCE', 'COMMERCIAL'];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') as ContractStatus | null;
    const customerId = searchParams.get('customerId');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '25');

    // Build where clause
    const where: any = {};
    const andClauses: any[] = [];
    if (userRole === 'COMMERCIAL') {
      andClauses.push({
        OR: [
          { deal: { ownerId: userId } },
          { customer: { createdById: userId } },
          { invoices: { some: { ownerId: userId } } },
        ],
      });
    }

    if (status) {
      where.status = status;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (search) {
      andClauses.push({
        OR: [
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { customer: { email: { contains: search, mode: 'insensitive' } } },
          { signerName: { contains: search, mode: 'insensitive' } },
        ],
      });
    }
    if (andClauses.length > 0) {
      where.AND = andClauses;
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
        invoices: {
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
    const userRole = (session.user as any).role;
    const userId = (session.user as any).id as string;
    const allowedRoles = ['ADMIN', 'FINANCE', 'COMMERCIAL'];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { customerId, invoiceId, signerName, signerEmail, expiresInDays = 30, templateId, program } = body;

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

    if (userRole === 'COMMERCIAL') {
      const canAccessCustomer = await prisma.customer.count({
        where: {
          id: customerId,
          OR: [
            { createdById: userId },
            { invoices: { some: { ownerId: userId } } },
            { deals: { some: { ownerId: userId } } },
          ],
        },
      });
      if (!canAccessCustomer) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Validate customer has required fields for contract
    const missingFields = validateCustomerForContract(customer);
    if (missingFields.length > 0) {
      return NextResponse.json({
        error: 'Dados do cliente incompletos para gerar contrato',
        missingFields: missingFields.map(f => ({ field: f.field, label: f.label })),
        message: `Preencha os seguintes dados do cliente antes de enviar o contrato: ${missingFields.map(f => f.label).join(', ')}`,
        customerId: customer.id,
        customerName: customer.name,
      }, { status: 422 });
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
      if (invoice.customerId !== customerId) {
        return NextResponse.json({ error: 'Invoice does not belong to customer' }, { status: 400 });
      }
      if (userRole === 'COMMERCIAL' && invoice.ownerId !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
          // clint_deal_id is nullable — left null for manual deals until Clint sync assigns it
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
        signerName,
        signerEmail,
        expiresAt,
        status: 'DRAFT',
      },
      include: {
        customer: true,
        invoices: true,
        deal: true,
      },
    });

    // Link all series invoices to this contract
    if (invoiceId) {
      const invoiceForLink = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { installments: true, customerId: true, dealId: true },
      });
      const installmentData = invoiceForLink?.installments as any;
      if (installmentData?.seriesId) {
        // Link ALL invoices in this series
        await prisma.invoice.updateMany({
          where: {
            customerId,
            installments: { path: ['seriesId'], equals: installmentData.seriesId },
          },
          data: { contractId: contract.id },
        });
      } else if (invoiceForLink?.dealId) {
        // Fallback: link all invoices from the same deal
        await prisma.invoice.updateMany({
          where: { customerId, dealId: invoiceForLink.dealId },
          data: { contractId: contract.id },
        });
      } else {
        // Single invoice — just link it
        await prisma.invoice.update({
          where: { id: invoiceId },
          data: { contractId: contract.id },
        });
      }
    }

    try {
      // Send to DocuSign
      let envelopeId: string;

      // Resolve the template ID from the program selection or direct templateId
      let resolvedTemplateId = templateId || null;

      const PROGRAM_LABEL_MAP: Record<string, string> = {
        pass_advanced: 'Programa Pass Advanced',
        pass: 'Programa Pass',
        combo: 'Programa Combo',
        start: 'Programa Start',
        avulso: 'Programa Avulso',
        upgrade: 'Upgrade',
        new_pass: 'New Pass',
        treinamento: 'Treinamento',
        early_career: 'Early Career',
      };
      const programLabel = program ? (PROGRAM_LABEL_MAP[program] || program) : undefined;

      if (program && !resolvedTemplateId) {
        // Map program key to env var name
        const PROGRAM_ENV_MAP: Record<string, string> = {
          pass_advanced: 'DOCUSIGN_TEMPLATE_PASS_ADVANCED',
          pass: 'DOCUSIGN_TEMPLATE_PASS',
          combo: 'DOCUSIGN_TEMPLATE_COMBO',
          start: 'DOCUSIGN_TEMPLATE_START',
          avulso: 'DOCUSIGN_TEMPLATE_AVULSO',
          upgrade: 'DOCUSIGN_TEMPLATE_UPGRADE',
          new_pass: 'DOCUSIGN_TEMPLATE_NEW_PASS',
          treinamento: 'DOCUSIGN_TEMPLATE_TREINAMENTO',
          early_career: 'DOCUSIGN_TEMPLATE_EARLY_CAREER',
        };

        const envVar = PROGRAM_ENV_MAP[program];
        if (envVar) {
          resolvedTemplateId = process.env[envVar]?.trim() || null;
          if (!resolvedTemplateId) {
            console.warn(`[API_CONTRACTS] No template configured for program "${program}" (${envVar})`);
          } else {
            console.log(`[API_CONTRACTS] Program "${program}" resolved to template ${resolvedTemplateId} via ${envVar}`);
          }
        }
      }

      if (resolvedTemplateId) {
        // Each template already contains the main contract + annex as two documents
        console.log(`[API_CONTRACTS] Creating envelope from template: ${resolvedTemplateId}`);

        // Build custom fields from customer and invoice data
        const customFields: Record<string, string> = {};
        // Client identification fields
        customFields['client_name'] = customer.name;
        customFields['client_email'] = customer.email;
        customFields['client_cpf'] = customer.cpf || '';
        customFields['client_passport'] = customer.passport || '';
        customFields['client_ssn_last4'] = getPreferredCustomerIdentification(customer);
        customFields['client_address'] = [
          customer.address, customer.city, customer.state,
          customer.zipCode, customer.country,
        ].filter(Boolean).join(', ');
        // Contract date
        customFields['contract_date_day'] = new Date().getDate().toString();
        customFields['contract_date_month'] = new Date().toLocaleDateString('pt-BR', { month: 'long' });
        customFields['contract_date_year'] = new Date().getFullYear().toString().slice(-2);
        // Legacy aliases
        customFields['customer_name'] = customer.name;
        customFields['customer_email'] = customer.email;
        // Invoice and installment fields
        if (invoice) {
          customFields['service_description'] = getInvoiceServiceDescription(invoice, program);
          customFields['invoice_number'] = invoice.invoiceNumber || '';
          customFields['invoice_numbers'] = invoice.invoiceNumber || '';
          customFields['invoice_amount'] = `$${parseFloat(invoice.amount.toString()).toFixed(2)}`;
          customFields['invoice_due_date'] = new Date(invoice.dueDate).toLocaleDateString('en-US');
          customFields['amount'] = `$${parseFloat(invoice.amount.toString()).toFixed(2)}`;
          customFields['due_date'] = new Date(invoice.dueDate).toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
          });

          // Installment/payment plan fields — individual tabLabels per line
          const installmentData = invoice.installments as any;

          // Resolve full invoice series: by seriesId → dealId → single
          let seriesInvoices: Awaited<ReturnType<typeof prisma.invoice.findMany>> = [];
          if (installmentData?.seriesId) {
            seriesInvoices = await prisma.invoice.findMany({
              where: {
                customerId,
                installments: { path: ['seriesId'], equals: installmentData.seriesId },
              },
              orderBy: { dueDate: 'asc' },
            });
          } else if ((invoice as any).dealId) {
            seriesInvoices = await prisma.invoice.findMany({
              where: { customerId, dealId: (invoice as any).dealId },
              orderBy: { dueDate: 'asc' },
            });
          }

          if (seriesInvoices.length > 1) {
            // Use the resolved series — same building logic regardless of grouping key

            const totalAmount = seriesInvoices.reduce(
              (sum, inv) => sum + parseFloat(inv.amount.toString()), 0
            );

            customFields['total_amount'] = `$${totalAmount.toFixed(2)}`;
            customFields['installment_count'] = seriesInvoices.length.toString();

            // Build payment plan description
            const entryInvoice = seriesInvoices.find(
              (inv) => (inv.installments as any)?.isFirstInstallment
            );
            const regularInvoices = seriesInvoices.filter(
              (inv) => !(inv.installments as any)?.isFirstInstallment
            );

            if (entryInvoice && regularInvoices.length > 0) {
              const entryAmt = parseFloat(entryInvoice.amount.toString());
              customFields['entry_amount'] = `$${entryAmt.toFixed(2)}`;
              customFields['entry_due_date'] = new Date(entryInvoice.dueDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              });
              customFields['payment_plan'] = `Entrada: $${entryAmt.toFixed(2)} + ${regularInvoices.length}x $${parseFloat(regularInvoices[0].amount.toString()).toFixed(2)}`;
            } else if (seriesInvoices.length > 1) {
              customFields['entry_amount'] = '';
              customFields['entry_due_date'] = '';
              customFields['payment_plan'] = `${seriesInvoices.length}x $${parseFloat(seriesInvoices[0].amount.toString()).toFixed(2)}`;
            }

            // Individual installment fields: installment_amount_1, due_date_1, etc.
            // Each line in the DocuSign template has its own tabLabel
            seriesInvoices.forEach((inv, idx) => {
              const num = idx + 1; // 1-indexed
              const amt = parseFloat(inv.amount.toString());
              const dueDate = new Date(inv.dueDate).toLocaleDateString('en-US', {
                year: 'numeric', month: 'long', day: 'numeric',
              });
              const dueDateShort = new Date(inv.dueDate).toLocaleDateString('pt-BR');

              customFields[`installment_amount_${num}`] = `$${amt.toFixed(2)}`;
              customFields[`due_date_${num}`] = dueDate;
              customFields[`due_date_short_${num}`] = dueDateShort;
              customFields[`invoice_number_${num}`] = inv.invoiceNumber || '';

              // Also set description for each line
              const instData = inv.installments as any;
              if (instData?.isFirstInstallment) {
                customFields[`installment_desc_${num}`] = 'Entrada';
              } else {
                const installmentNum = instData?.current ? instData.current - (entryInvoice ? 1 : 0) : idx + 1;
                customFields[`installment_desc_${num}`] = `Parcela ${installmentNum}`;
              }
            });

            // Clear unused installment slots (up to 12) so template doesn't show stale data
            for (let n = seriesInvoices.length + 1; n <= 12; n++) {
              customFields[`installment_amount_${n}`] = '';
              customFields[`due_date_${n}`] = '';
              customFields[`due_date_short_${n}`] = '';
              customFields[`invoice_number_${n}`] = '';
              customFields[`installment_desc_${n}`] = '';
            }

            // Legacy: keep single installment_amount for backward compat with older templates
            if (regularInvoices.length > 0) {
              customFields['installment_amount'] = `$${parseFloat(regularInvoices[0].amount.toString()).toFixed(2)}`;
            }

            // All invoice numbers in the series
            customFields['invoice_numbers'] = seriesInvoices
              .map((inv) => inv.invoiceNumber)
              .filter(Boolean)
              .join(', ');
          } else {
            // Single payment — total = invoice amount
            customFields['total_amount'] = `$${parseFloat(invoice.amount.toString()).toFixed(2)}`;
            customFields['payment_plan'] = `Pagamento único: $${parseFloat(invoice.amount.toString()).toFixed(2)}`;
            customFields['installment_count'] = '1';
            customFields['entry_amount'] = '';
            customFields['installment_amount'] = '';

            // Single payment as installment_1
            customFields['installment_amount_1'] = `$${parseFloat(invoice.amount.toString()).toFixed(2)}`;
            customFields['due_date_1'] = new Date(invoice.dueDate).toLocaleDateString('en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            });
            customFields['due_date_short_1'] = new Date(invoice.dueDate).toLocaleDateString('pt-BR');
            customFields['invoice_number_1'] = invoice.invoiceNumber || '';
            customFields['installment_desc_1'] = 'Pagamento único';

            // Clear remaining slots
            for (let n = 2; n <= 12; n++) {
              customFields[`installment_amount_${n}`] = '';
              customFields[`due_date_${n}`] = '';
              customFields[`due_date_short_${n}`] = '';
              customFields[`invoice_number_${n}`] = '';
              customFields[`installment_desc_${n}`] = '';
            }
          }
        }

        envelopeId = await docusignService.createEnvelopeFromSelectedTemplate(
          resolvedTemplateId,
          signerEmail,
          signerName,
          customFields,
          programLabel
        );
      } else {
        // Fallback to invoice-based template resolution (keyword matching) or inline PDF
        const invoiceForDocuSign = invoice || {
          id: `manual-${contract.id}`,
          invoiceNumber: `MANUAL-${Date.now()}`,
          amount: '0.00',
          dueDate: expiresAt,
          customerId: customer.id,
        } as any;

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
          invoices: true,
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
