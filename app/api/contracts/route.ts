import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { ContractStatus } from '@prisma/client';

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
