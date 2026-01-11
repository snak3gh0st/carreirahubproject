import { NextRequest, NextResponse } from "next/server";
import { leadService } from "@/lib/services/lead.service";
import { z } from "zod";

const qualifyLeadSchema = z.object({
  qualifiedById: z.string().uuid().optional(),
});

/**
 * POST /api/leads/[id]/qualify
 * Qualificar lead manualmente ou via AI
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const { qualifiedById } = qualifyLeadSchema.parse(body);

    // Qualificar lead (AI será usado automaticamente se não fornecer dados)
    const lead = await leadService.qualifyLead(params.id, undefined, qualifiedById);

    return NextResponse.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Error qualifying lead:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

