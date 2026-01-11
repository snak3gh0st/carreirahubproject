import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { quickbooksService } from "@/lib/services/quickbooks.service";
import { identityMapper } from "@/lib/services/identity-mapper";
import { prisma } from "@/lib/db";

/**
 * POST /api/quickbooks/sync/customers
 * 
 * Sincroniza todos os customers do QuickBooks para o hub
 */
export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Buscar todos os customers do QuickBooks
    const qbCustomers = await quickbooksService.getAllCustomers();

    const synced: string[] = [];
    const updated: string[] = [];
    const errors: Array<{ email: string; error: string }> = [];

    for (const qbCustomer of qbCustomers) {
      try {
        const email = qbCustomer.PrimaryEmailAddr?.Address;
        const name = qbCustomer.DisplayName || qbCustomer.CompanyName || "Unknown";
        const phone = qbCustomer.PrimaryPhone?.FreeFormNumber;

        if (!email) {
          errors.push({
            email: "N/A",
            error: "Customer sem email no QuickBooks",
          });
          continue;
        }

        // Verificar se customer já existe
        const existing = await prisma.customer.findUnique({
          where: { email },
        });

        // Sincronizar usando Identity Mapper
        const customer = await identityMapper.reconcileCustomer({
          email,
          name,
          phone,
          externalIds: {
            quickbooks_id: qbCustomer.Id,
          },
          metadata: {
            quickbooks: {
              syncDate: new Date().toISOString(),
              companyName: qbCustomer.CompanyName,
              balance: qbCustomer.Balance,
              balanceWithJobs: qbCustomer.BalanceWithJobs,
              currencyRef: qbCustomer.CurrencyRef,
              preferredDeliveryMethod: qbCustomer.PreferredDeliveryMethod,
            },
          },
        });

        if (existing) {
          updated.push(customer.id);
        } else {
          synced.push(customer.id);
        }
      } catch (error: any) {
        errors.push({
          email: qbCustomer.PrimaryEmailAddr?.Address || "N/A",
          error: error.message || "Unknown error",
        });
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        total: qbCustomers.length,
        synced: synced.length,
        updated: updated.length,
        errors: errors.length,
      },
      synced,
      updated,
      errors,
    });
  } catch (error: any) {
    console.error("Error syncing QuickBooks customers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to sync QuickBooks customers" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/quickbooks/sync/customers
 * 
 * Lista customers do QuickBooks (sem sincronizar)
 */
export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const customers = await quickbooksService.getAllCustomers();
    return NextResponse.json({
      count: customers.length,
      customers: customers.map((c: any) => ({
        id: c.Id,
        name: c.DisplayName || c.CompanyName,
        email: c.PrimaryEmailAddr?.Address,
        phone: c.PrimaryPhone?.FreeFormNumber,
        balance: c.Balance,
      })),
    });
  } catch (error: any) {
    console.error("Error fetching QuickBooks customers:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch QuickBooks customers" },
      { status: 500 }
    );
  }
}







