import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getRealtimeHubTestCredentials,
  isRealtimeTestLoginAllowed,
} from "@/lib/hub/realtime-test-credential";
import {
  hashPassword,
  setHubCookie,
  signHubToken,
  type HubJwtPayload,
} from "@/lib/hub-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getBaseUrl(request: NextRequest) {
  const protocol = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("host") || "localhost:3001";
  return `${protocol}://${host}`;
}

export async function GET(request: NextRequest) {
  const host = request.headers.get("host");
  const token = request.nextUrl.searchParams.get("token");

  if (!isRealtimeTestLoginAllowed({ host, token })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const credentials = getRealtimeHubTestCredentials();
  const passwordHash = await hashPassword(credentials.password);

  const customer = await prisma.customer.upsert({
    where: { email: credentials.email },
    update: {
      name: credentials.name,
      preferredLanguage: "en",
      metadata: {
        source: "hub_realtime_test_login",
        purpose: "gpt_realtime_english_test",
      },
    },
    create: {
      email: credentials.email,
      name: credentials.name,
      preferredLanguage: "en",
      metadata: {
        source: "hub_realtime_test_login",
        purpose: "gpt_realtime_english_test",
      },
    },
    select: { id: true, email: true, name: true },
  });

  const clientUser = await prisma.clientUser.upsert({
    where: { email: credentials.email },
    update: {
      passwordHash,
      mustResetPw: false,
      tempPasswordExpiresAt: null,
      failedLoginCount: 0,
      lockedUntil: null,
      language: "en",
      customerId: customer.id,
    },
    create: {
      email: credentials.email,
      passwordHash,
      mustResetPw: false,
      language: "en",
      customerId: customer.id,
    },
    select: { id: true, email: true, customerId: true, language: true },
  });

  const payload: HubJwtPayload = {
    clientUserId: clientUser.id,
    customerId: clientUser.customerId,
    email: clientUser.email,
    language: clientUser.language,
  };
  const hubToken = await signHubToken(payload);

  if (request.nextUrl.searchParams.get("json") === "1") {
    const response = NextResponse.json({
      ok: true,
      loginUrl: `${getBaseUrl(request)}/hub/login`,
      route: `${getBaseUrl(request)}/hub/test/realtime`,
      debugLoginUrl: `${getBaseUrl(request)}/api/debug/hub-realtime-test-login`,
      credentials,
    });
    setHubCookie(response, hubToken);
    return response;
  }

  const response = NextResponse.redirect(new URL("/hub/test/realtime", request.url));
  setHubCookie(response, hubToken);
  return response;
}
