import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { identityMapper } from "@/lib/services/identity-mapper";
import { createUserFallbackResponse, categorizeByStatusCode } from "@/lib/utils/error-fallback";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { integrationLogger } from "@/lib/utils/logger";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const requiredString = (field: string) =>
  z.string().trim().min(1, `${field} é obrigatório`);

const createCustomerSchema = z.object({
  email: z.string().trim().email(),
  name: requiredString("Nome"),
  phone: requiredString("Telefone"),
  dateOfBirth: requiredString("Data de nascimento"),
  ssn: z.string().optional(),
  passport: z.string().optional(),
  cpf: z.string().optional(),
  address: requiredString("Endereço"),
  city: requiredString("Cidade"),
  state: requiredString("Estado"),
  zipCode: requiredString("CEP"),
  country: requiredString("País"),
  clint_contact_id: z.number().optional(),
  quickbooks_id: z.string().optional(),
  metadata: z.any().optional(),
}).superRefine((data, ctx) => {
  if (!data.passport?.trim() && !data.cpf?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe passaporte ou CPF",
      path: ["passport"],
    });
  }
});

/**
 * GET /api/customers
 * Listar customers
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userRole = (session.user as any).role;
    const userId = (session.user as any).id as string;
    const allowedRoles = ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get("email");
    const search = searchParams.get("search")?.trim();
    const selectedId = searchParams.get("selectedId");
    const requestedLimit = parseInt(searchParams.get("limit") || "50");
    const limit = Math.min(Math.max(requestedLimit, 1), 200);
    const offset = Math.max(parseInt(searchParams.get("offset") || "0"), 0);

    const where: any = {};
    const andClauses: any[] = [];
    if (email) andClauses.push({ email: { contains: email, mode: "insensitive" } });
    if (search) {
      andClauses.push({
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      });
    }
    if (userRole === "COMMERCIAL") {
      andClauses.push({
        OR: [
          { createdById: userId },
          { invoices: { some: { ownerId: userId } } },
          { deals: { some: { ownerId: userId } } },
        ],
      });
    }
    if (andClauses.length > 0) {
      where.AND = andClauses;
    }

    const total = await prisma.customer.count({ where });

    const customerInclude = {
      deals: {
        take: 5,
        orderBy: { createdAt: "desc" as const },
      },
      invoices: {
        take: 5,
        orderBy: { createdAt: "desc" as const },
      },
    };

    let customers = await prisma.customer.findMany({
      where,
      include: customerInclude,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    });

    if (selectedId && !customers.some((customer) => customer.id === selectedId)) {
      const selectedAndClauses: any[] = [{ id: selectedId }];
      if (userRole === "COMMERCIAL") {
        selectedAndClauses.push({
          OR: [
            { createdById: userId },
            { invoices: { some: { ownerId: userId } } },
            { deals: { some: { ownerId: userId } } },
          ],
        });
      }
      const selectedCustomer = await prisma.customer.findFirst({
        where: { AND: selectedAndClauses },
        include: customerInclude,
      });
      if (selectedCustomer) {
        customers = [selectedCustomer, ...customers];
      }
    }

    return NextResponse.json({
      customers,
      pagination: {
        limit,
        offset,
        total,
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

    // Check authorization - COMMERCIAL, FINANCE, ADMIN can create customers
    const userRole = (session.user as any).role;
    const allowedRoles = ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"];
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const data = createCustomerSchema.parse(body);

    const userId = (session.user as any).id as string;

    // Usar Identity Mapper para criar/atualizar customer
    let customer = await identityMapper.reconcileCustomer({
      email: data.email,
      name: data.name,
      phone: data.phone,
      dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      ssn: data.ssn,
      passport: data.passport,
      cpf: data.cpf,
      address: data.address,
      city: data.city,
      state: data.state,
      zipCode: data.zipCode,
      country: data.country,
      externalIds: {
        clint_contact_id: data.clint_contact_id ? String(data.clint_contact_id) : undefined,
        quickbooks_id: data.quickbooks_id,
      },
      metadata: data.metadata,
    });

    // Set createdById if not already set (preserve original creator)
    if (!customer.createdById && userId) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { createdById: userId },
      });
    }

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
          ssn: customer.ssn || undefined,
          passport: customer.passport || undefined,
          cpf: customer.cpf || undefined,
          address: customer.address || undefined,
          city: customer.city || undefined,
          state: customer.state || undefined,
          zipCode: customer.zipCode || undefined,
          country: customer.country || undefined,
        });

        // Update customer with QB ID
        await prisma.customer.update({
          where: { id: customer.id },
          data: { quickbooks_id: String(qbCustomer.Id) },
        });

        // **REALTIME SYNC**: Immediately sync customer back from QuickBooks
        try {
          const { quickbooksSyncService } = await import('@/lib/services/quickbooks-sync.service');
          await quickbooksSyncService.syncSingleCustomer(String(qbCustomer.Id));
          console.log(`[CUSTOMER_CREATE] Customer ${qbCustomer.Id} synced from QuickBooks`);
        } catch (syncError) {
          console.error(`[CUSTOMER_CREATE] Failed to sync customer ${qbCustomer.Id} from QuickBooks:`, syncError);
          // Don't fail customer creation if sync fails
        }

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
      syncedSystems: {
        quickbooks: qbCustomer ? true : false,
      },
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
