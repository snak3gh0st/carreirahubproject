import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/lib/services/lead.service";
import { createUserFallbackResponse, categorizeByStatusCode } from "@/lib/utils/error-fallback";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { LeadSource, LeadStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const createLeadSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  source: z.nativeEnum(LeadSource).optional(),
  clint_contact_id: z.union([z.string(), z.number()]).optional(),
  metadata: z.any().optional(),
});

/**
 * GET /api/leads
 * Listar leads com filtros opcionais
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    const userId = (session?.user as any)?.id;

    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as LeadStatus | null;
    const source = searchParams.get("source") as LeadSource | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const isVendedor = role === "COMMERCIAL" && !!userId;

    let additionalLeadIds: string[] | undefined;
    if (isVendedor) {
      const invoicesOwned = await prisma.invoice.findMany({
        where: { ownerId: userId, dealId: { not: null } },
        select: { deal: { select: { convertedFromLeadId: true } } },
      });
      additionalLeadIds = invoicesOwned
        .map((inv) => inv.deal?.convertedFromLeadId)
        .filter((id): id is string => !!id);
    }

    const leads = await leadService.listLeads({
      status: status || undefined,
      source: source || undefined,
      limit,
      offset,
      createdById: isVendedor ? userId : undefined,
      additionalLeadIds,
    });

    return NextResponse.json({
      leads,
      pagination: {
        limit,
        offset,
        total: leads.length,
      },
    });
  } catch (error) {
    console.error("Error listing leads:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/leads
 * Criar novo lead
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    const body = await request.json();
    const data = createLeadSchema.parse(body);
    const normalizedData = {
      ...data,
      clint_contact_id:
        data.clint_contact_id !== undefined
          ? String(data.clint_contact_id)
            : undefined,
    };

    const lead = await leadService.createLead({ ...normalizedData, createdById: userId });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating lead:", error);

    // Provide graceful fallback for integration errors
    const errorCategory = categorizeByStatusCode((error as any)?.status);
    const fallback = createUserFallbackResponse("clint", "create_lead", errorCategory);

    // Return appropriate status code based on error type
    const statusCode = errorCategory === "transient" ? 202 : 500;
    return NextResponse.json(fallback, { status: statusCode });
  }
}
