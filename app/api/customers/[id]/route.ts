import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { normalizeSsnLast4 } from "@/lib/customers/sensitive-identification";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const CUSTOMER_MANAGEMENT_ROLES = ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"];

async function requireCustomerManagementAccess() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const userRole = (session.user as any).role;
  if (!CUSTOMER_MANAGEMENT_ROLES.includes(userRole)) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { session };
}

const updateCustomerSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  ssn: z.string().optional(),
  passport: z.string().optional(),
  cpf: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
  country: z.string().optional(),
  clint_contact_id: z.string().optional(),
  quickbooks_id: z.string().optional(),
  metadata: z.any().optional(),
});

/**
 * GET /api/customers/[id]
 * Buscar customer por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireCustomerManagementAccess();
    if ("response" in access) return access.response;

    const customer = await prisma.customer.findUnique({
      where: { id: params.id },
      include: {
        deals: {
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          orderBy: { createdAt: "desc" },
        },
        contracts: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Customer not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error("Error fetching customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/customers/[id]
 * Atualizar customer with QuickBooks sync
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const access = await requireCustomerManagementAccess();
    if ("response" in access) return access.response;

    const body = await request.json();
    const data = updateCustomerSchema.parse(body);
    const updateData = {
      ...data,
      ...(data.ssn !== undefined ? { ssn: normalizeSsnLast4(data.ssn) ?? null } : {}),
    };

    // Update customer in database
    const customer = await prisma.customer.update({
      where: { id: params.id },
      data: updateData,
    });

    // Prepare QuickBooks sync response
    let quickbooksSync = {
      synced: false,
      message: "QuickBooks não conectado",
    };

    // If customer has QuickBooks ID, sync changes
    if (customer.quickbooks_id) {
      try {
        // Initialize QuickBooks service
        await quickbooksService.initialize();

        // Prepare updates object (only include fields that were changed)
        const qbUpdates: any = {};

        if (data.name !== undefined) {
          qbUpdates.name = data.name;
        }
        if (data.phone !== undefined) {
          qbUpdates.phone = data.phone;
        }
        if (data.address !== undefined) {
          qbUpdates.address = data.address;
        }
        if (data.city !== undefined) {
          qbUpdates.city = data.city;
        }
        if (data.state !== undefined) {
          qbUpdates.state = data.state;
        }
        if (data.zipCode !== undefined) {
          qbUpdates.zipCode = data.zipCode;
        }

        // Only sync if there are QB-relevant fields to update
        if (Object.keys(qbUpdates).length > 0) {
          console.log(`[API] Syncing customer ${customer.id} to QuickBooks...`, qbUpdates);
          await quickbooksService.updateCustomer(customer.quickbooks_id, qbUpdates);
          
          // **REALTIME SYNC**: Immediately sync customer back from QuickBooks
          try {
            const { quickbooksSyncService } = await import('@/lib/services/quickbooks-sync.service');
            await quickbooksSyncService.syncSingleCustomer(customer.quickbooks_id);
            console.log(`[API] Customer ${customer.quickbooks_id} synced from QuickBooks`);
          } catch (syncError) {
            console.error(`[API] Failed to sync customer ${customer.quickbooks_id} from QuickBooks:`, syncError);
            // Don't fail update if sync fails
          }
          
          quickbooksSync = {
            synced: true,
            message: "Sincronizado com QuickBooks",
          };
          console.log(`[API] ✓ Customer ${customer.id} synced to QuickBooks successfully`);
        } else {
          quickbooksSync = {
            synced: false,
            message: "Nenhum campo relevante para sincronizar com QuickBooks",
          };
        }
      } catch (qbError: any) {
        console.error(`[API] Error syncing customer ${customer.id} to QuickBooks:`, qbError);
        quickbooksSync = {
          synced: false,
          message: `Erro ao sincronizar com QuickBooks: ${qbError.message || "Erro desconhecido"}`,
        };
      }
    }

    return NextResponse.json({
      customer,
      quickbooksSync,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating customer:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
