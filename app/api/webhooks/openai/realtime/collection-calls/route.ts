import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  COLLECTION_CALL_DEFAULT_MODEL,
  COLLECTION_CALL_DEFAULT_VOICE,
  buildCollectionCallOpenAiAcceptPayload,
  getCollectionCallPublicBaseUrl,
} from "@/lib/services/collection-call-voice";
import { buildOpenAIAuthHeaders } from "@/lib/services/openai-auth-headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const OPENAI_REALTIME_CALLS_URL = "https://api.openai.com/v1/realtime/calls";

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function extractOpenAiCallId(body: any): string | null {
  return (
    readString(body?.call_id) ||
    readString(body?.call?.call_id) ||
    readString(body?.data?.call_id) ||
    readString(body?.data?.call?.call_id)
  );
}

function findHeaderValue(value: unknown, headerName: string): string | null {
  const expected = headerName.toLowerCase();
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findHeaderValue(item, headerName);
      if (found) return found;
    }
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const [key, raw] of Object.entries(record)) {
    if (key.toLowerCase() === expected && typeof raw === "string") {
      return raw;
    }
    if (key.toLowerCase() === "name" && String(raw).toLowerCase() === expected) {
      const headerValue = readString(record.value) || readString(record.val);
      if (headerValue) return headerValue;
    }
    const nested = findHeaderValue(raw, headerName);
    if (nested) return nested;
  }

  return null;
}

function extractCollectionCallId(body: any): string | null {
  return (
    readString(body?.collectionCallId) ||
    readString(body?.collection_call_id) ||
    readString(body?.call?.metadata?.collectionCallId) ||
    readString(body?.call?.metadata?.collection_call_id) ||
    findHeaderValue(body, "X-Collection-Call-Id")
  );
}

export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = readString(body?.type) || readString(body?.event) || "";
  if (eventType && !eventType.includes("realtime.call.incoming")) {
    return NextResponse.json({ ignored: true, eventType });
  }

  const openAiCallId = extractOpenAiCallId(body);
  const collectionCallId = extractCollectionCallId(body);
  if (!openAiCallId || !collectionCallId) {
    return NextResponse.json(
      { error: "Missing OpenAI call id or collection call id" },
      { status: 400 }
    );
  }

  const collectionCall = await prisma.collectionCall.findUnique({
    where: { id: collectionCallId },
    include: {
      invoice: true,
      customer: true,
    },
  });

  if (!collectionCall) {
    return NextResponse.json({ error: "Collection call not found" }, { status: 404 });
  }

  const baseUrl = getCollectionCallPublicBaseUrl();
  const paymentUrl = baseUrl ? `${baseUrl}/hub/pay/${collectionCall.invoiceId}` : undefined;
  const daysOverdue = Math.max(
    0,
    Math.floor((Date.now() - collectionCall.invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24))
  );

  const acceptPayload = buildCollectionCallOpenAiAcceptPayload({
    model: process.env.COLLECTION_CALL_OPENAI_REALTIME_MODEL || COLLECTION_CALL_DEFAULT_MODEL,
    voice: process.env.COLLECTION_CALL_OPENAI_VOICE || COLLECTION_CALL_DEFAULT_VOICE,
    customerName: collectionCall.customer.name || collectionCall.customer.email || "cliente",
    invoiceNumber: collectionCall.invoice.invoiceNumber || collectionCall.invoiceId.slice(0, 8),
    amountDue: Number(collectionCall.invoice.amount),
    daysOverdue,
    paymentUrl,
  });

  const apiKey = process.env.OPENAI_REALTIME_API_KEY || process.env.OPENAI_API_KEY;
  const response = await fetch(`${OPENAI_REALTIME_CALLS_URL}/${openAiCallId}/accept`, {
    method: "POST",
    headers: buildOpenAIAuthHeaders({
      apiKey,
      contentType: "application/json",
    }),
    body: JSON.stringify(acceptPayload),
  });

  const responseText = await response.text();
  if (!response.ok) {
    await prisma.integrationLog.create({
      data: {
        service: "TWILIO_OPENAI_REALTIME",
        action: "OPENAI_REALTIME_CALL_ACCEPT_FAILED",
        status: "ERROR",
        error: responseText.slice(0, 500),
        payload: {
          collectionCallId,
          openAiCallId,
          status: response.status,
        } as any,
      },
    });
    return NextResponse.json(
      { error: "Failed to accept OpenAI realtime call", detail: responseText.slice(0, 300) },
      { status: 502 }
    );
  }

  await prisma.collectionCall.update({
    where: { id: collectionCallId },
    data: {
      status: "IN_PROGRESS",
      startedAt: new Date(),
      notes: `OpenAI realtime call accepted: ${openAiCallId}`,
    },
  });

  return NextResponse.json({ accepted: true, collectionCallId, openAiCallId });
}

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "openai-realtime-collection-calls",
  });
}
