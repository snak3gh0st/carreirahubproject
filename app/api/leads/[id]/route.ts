import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/lib/services/lead.service";
import { z } from "zod";
import { LeadStatus } from "@prisma/client";

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  status: z.nativeEnum(LeadStatus).optional(),
  qualificationScore: z.number().min(0).max(100).optional(),
  qualificationData: z.any().optional(),
  metadata: z.any().optional(),
});

/**
 * GET /api/leads/[id]
 * Buscar lead por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lead = await leadService.getLeadById(params.id);

    if (!lead) {
      return NextResponse.json(
        { error: "Lead not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Error fetching lead:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/leads/[id]
 * Atualizar lead
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = updateLeadSchema.parse(body);

    const lead = await leadService.updateLead(params.id, data);

    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error updating lead:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

