import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/lib/services/lead.service";
import { z } from "zod";
import { LeadSource, LeadStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

const createLeadSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().optional(),
  source: z.nativeEnum(LeadSource).optional(),
  pipedrive_person_id: z.number().optional(),
  metadata: z.any().optional(),
});

/**
 * GET /api/leads
 * Listar leads com filtros opcionais
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status") as LeadStatus | null;
    const source = searchParams.get("source") as LeadSource | null;
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const leads = await leadService.listLeads({
      status: status || undefined,
      source: source || undefined,
      limit,
      offset,
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
    const body = await request.json();
    const data = createLeadSchema.parse(body);

    const lead = await leadService.createLead(data);

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error creating lead:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

