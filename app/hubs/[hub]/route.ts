import { NextRequest, NextResponse } from "next/server";
import { getHubLink } from "@/lib/hub-links";

export function GET(
  request: NextRequest,
  { params }: { params: { hub: string } }
) {
  const hub = getHubLink(params.hub);
  const target = hub?.path ?? "/";

  return NextResponse.redirect(new URL(target, request.url));
}
