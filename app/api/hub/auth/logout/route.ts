import { NextResponse } from "next/server";
import { clearHubCookie } from "@/lib/hub-auth";
import { buildHubRedirectUrl } from "@/lib/hub-links";

export const dynamic = "force-dynamic";

/**
 * POST /api/hub/auth/logout
 *
 * Clear the hub-token cookie to log the client out.
 */
export async function POST(request: Request) {
  try {
    const url = buildHubRedirectUrl(
      "/hub/login",
      request.url,
      request.headers,
      process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXTAUTH_URL ||
        "https://app.carreirausa.com"
    );
    const response = NextResponse.redirect(url);
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
