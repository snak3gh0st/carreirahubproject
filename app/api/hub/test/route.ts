import { NextRequest, NextResponse } from "next/server";
import { getHubAuth } from "@/lib/hub-auth";
import { QUESTIONS } from "@/lib/hub/english-test";

export const dynamic = "force-dynamic";

/**
 * GET /api/hub/test
 * Return test questions (no correct answers included).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await getHubAuth(request);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({ questions: QUESTIONS });
  } catch (error) {
    console.error("[Hub Test] Error fetching questions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
