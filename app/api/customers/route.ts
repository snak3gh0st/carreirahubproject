import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { identityMapper } from "@/lib/services/identity-mapper";
import { createUserFallbackResponse, categorizeByStatusCode } from "@/lib/utils/error-fallback";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
 * Criar novo customer (usando Identity Mapper e sincronizando com QuickBooks)
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check authorization - COMMERCIAL, FINANCE, ADMIN, SALES can create customers
    const userRole = (session.user as any).role;
    const allowedRoles = ["ADMIN", "FINANCE", "COMMERCIAL", "SALES"];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

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

    // Sync to QuickBooks if not already synced
    let qbCustomer = null;
    if (!customer.quickbooks_id) {
      try {
        console.log(`[CUSTOMER_CREATE] Syncing customer ${customer.id} to QuickBooks...`);
        await quickbooksService.initialize();

        qbCustomer = await quickbooksService.getOrCreateCustomer({
          email: customer.email,
          name: customer.name,
          phone: customer.phone || undefined,
        });

        // Update customer with QB ID
        await prisma.customer.update({
          where: { id: customer.id },
          data: { quickbooks_id: String(qbCustomer.Id) },
        });

        // Log success
        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "customer_created",
            status: "SUCCESS",
            payload: {
              customerId: customer.id,
              qbCustomerId: qbCustomer.Id,
            } as any,
          },
        });

        console.log(`[CUSTOMER_CREATE] ✓ Customer synced to QuickBooks: ${qbCustomer.Id}`);
      } catch (qbError: any) {
        console.error(`[CUSTOMER_CREATE] ✗ Failed to sync to QuickBooks:`, qbError);

        // Log error
        await prisma.integrationLog.create({
          data: {
            service: "quickbooks",
            action: "customer_creation_failed",
            status: "ERROR",
            error: qbError.message || "Unknown error",
            payload: {
              customerId: customer.id,
              customerEmail: customer.email,
            } as any,
          },
        });

        // Don't fail customer creation if QB sync fails
        // Customer will be synced later when creating invoice
      }
    }

    return NextResponse.json({
      customer,
      quickbooksSync: qbCustomer ? {
        synced: true,
        qbId: qbCustomer.Id,
      } : {
        synced: false,
        message: "Customer created locally. Will sync to QuickBooks when creating invoice.",
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating customer:", error);

    // Provide graceful fallback for integration errors
    const errorCategory = categorizeByStatusCode((error as any)?.status);
    const fallback = createUserFallbackResponse("quickbooks", "customer_creation", errorCategory);

    // Return appropriate status code based on error type
    const statusCode = errorCategory === "transient" ? 202 : 500;
    return NextResponse.json(fallback, { status: statusCode });
  }
}

