import { NextResponse } from "next/server";
import { clearHubCookie } from "@/lib/hub-auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/hub/auth/logout
 *
 * Clear the hub-token cookie to log the client out.
 */
export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    clearHubCookie(response);
    return response;
  } catch (error) {
    console.error("[HUB_LOGOUT] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
