import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { identityMapper } from "@/lib/services/identity-mapper";
import { z } from "zod";

export const dynamic = "force-dynamic";

const createCustomerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  document: z.string().optional(),
  pipedrive_id: z.number().optional(),
  stripe_id: z.string().optional(),
  quickbooks_id: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * GET /api/customers
 * Listar customers
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: any = {};
    if (email) where.email = { contains: email, mode: "insensitive" };

    const customers = await prisma.customer.findMany({
      where,
      include: {
        deals: {
          take: 5,
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          take: 5,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    return NextResponse.json({
      customers,
      pagination: {
        limit,
        offset,
        total: customers.length,
      },
    });
  } catch (error) {
    console.error("Error listing customers:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/customers
 * Criar novo customer (usando Identity Mapper)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createCustomerSchema.parse(body);

    // Usar Identity Mapper para criar/atualizar customer
    const customer = await identityMapper.reconcileCustomer({
      email: data.email,
      name: data.name,
      phone: data.phone,
      document: data.document,
      externalIds: {
        pipedrive_id: data.pipedrive_id,
        stripe_id: data.stripe_id,
        quickbooks_id: data.quickbooks_id,
      },
      metadata: data.metadata,
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

