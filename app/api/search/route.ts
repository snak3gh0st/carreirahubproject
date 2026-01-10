import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/search
 * Global search across invoices, customers, leads, and deals
 * Query parameter: q (search query)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const query = request.nextUrl.searchParams.get("q")

    if (!query || query.trim().length === 0) {
      return NextResponse.json({
        invoices: [],
        customers: [],
        leads: [],
        deals: [],
      })
    }

    const searchTerm = `%${query}%`

    // Search across all entities with limit of 5 results per category
    const [invoices, customers, leads, deals] = await Promise.all([
      // Search invoices by invoice number or customer name
      prisma.invoice.findMany({
        where: {
          OR: [
            { invoiceNumber: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        include: { customer: true },
        take: 5,
      }),

      // Search customers by name or email
      prisma.customer.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),

      // Search leads by name or email
      prisma.lead.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        },
        take: 5,
      }),

      // Search deals by title or customer name
      prisma.deal.findMany({
        where: {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { customer: { name: { contains: query, mode: "insensitive" } } },
          ],
        },
        include: { customer: true },
        take: 5,
      }),
    ])

    return NextResponse.json({
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        type: "invoice",
        title: `Invoice ${invoice.invoiceNumber}`,
        subtitle: invoice.customer.name,
        href: `/dashboard/invoices/${invoice.id}`,
        amount: invoice.amount,
        status: invoice.status,
      })),

      customers: customers.map((customer) => ({
        id: customer.id,
        type: "customer",
        title: customer.name,
        subtitle: customer.email,
        href: `/dashboard/customers/${customer.id}`,
      })),

      leads: leads.map((lead) => ({
        id: lead.id,
        type: "lead",
        title: lead.name,
        subtitle: lead.email,
        href: `/dashboard/leads/${lead.id}`,
        status: lead.status,
      })),

      deals: deals.map((deal) => ({
        id: deal.id,
        type: "deal",
        title: deal.title,
        subtitle: deal.customer?.name || "No customer",
        href: `/dashboard/deals/${deal.id}`,
        status: deal.status,
        value: deal.value,
      })),
    })
  } catch (error) {
    console.error("[SEARCH] Error:", error)
    return NextResponse.json(
      { error: "Failed to search" },
      { status: 500 }
    )
  }
}
