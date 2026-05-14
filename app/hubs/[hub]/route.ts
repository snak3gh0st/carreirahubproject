import { NextRequest, NextResponse } from "next/server";
import { buildHubRedirectUrl, getHubLink } from "@/lib/hub-links";

export function GET(
  request: NextRequest,
  { params }: { params: { hub: string } }
) {
  const hub = getHubLink(params.hub);
  const target = hub?.path ?? "/";
  const fallbackBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

  return NextResponse.redirect(
    buildHubRedirectUrl(target, request.url, request.headers, fallbackBaseUrl)
  );
}
