import { NextRequest, NextResponse } from "next/server";
import {
  ACCESS_AUDIT_ACTIONS,
  createAccessAuditLog,
  isAuditablePath,
} from "@/lib/admin/access-audit";

export const dynamic = "force-dynamic";

function getAuditSecret() {
  return (
    process.env.ACCESS_AUDIT_SECRET ||
    process.env.CRON_SECRET ||
    process.env.NEXTAUTH_SECRET
  );
}

function validActorType(value: unknown) {
  return value === "internal" || value === "client" || value === "anonymous" || value === "system";
}

function validOutcome(value: unknown) {
  return value === "success" || value === "failure" || value === "blocked";
}

export async function POST(request: NextRequest) {
  const expectedSecret = getAuditSecret();
  if (!expectedSecret || request.headers.get("x-access-audit-secret") !== expectedSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const event = body as Record<string, any>;
  if (!isAuditablePath(event.path)) {
    return NextResponse.json({ skipped: true });
  }

  await createAccessAuditLog({
    action: typeof event.action === "string" ? event.action : ACCESS_AUDIT_ACTIONS.ENDPOINT_ACCESS,
    actorType: validActorType(event.actorType) ? event.actorType : "anonymous",
    outcome: validOutcome(event.outcome) ? event.outcome : "success",
    userId: typeof event.userId === "string" ? event.userId : undefined,
    clientUserId: typeof event.clientUserId === "string" ? event.clientUserId : undefined,
    customerId: typeof event.customerId === "string" ? event.customerId : undefined,
    email: typeof event.email === "string" ? event.email : undefined,
    role: typeof event.role === "string" ? event.role : undefined,
    method: typeof event.method === "string" ? event.method : undefined,
    path: typeof event.path === "string" ? event.path : undefined,
    statusCode: typeof event.statusCode === "number" ? event.statusCode : undefined,
    ip: typeof event.ip === "string" ? event.ip : undefined,
    userAgent: typeof event.userAgent === "string" ? event.userAgent : undefined,
    host: typeof event.host === "string" ? event.host : undefined,
    source: "middleware",
    error: typeof event.error === "string" ? event.error : undefined,
    metadata: {
      actorName: typeof event.actorName === "string" ? event.actorName : undefined,
      routeType: typeof event.routeType === "string" ? event.routeType : undefined,
    },
  });

  return NextResponse.json({ ok: true });
}
