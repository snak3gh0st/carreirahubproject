import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildCollectionCallSipUri } from "@/lib/services/collection-call-voice";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function handler(request: NextRequest) {
  const collectionCallId = request.nextUrl.searchParams.get("collectionCallId");
  const projectId = process.env.OPENAI_PROJECT_ID?.trim();

  if (!collectionCallId || !projectId) {
    return new NextResponse(
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Hangup/></Response>",
      { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } }
    );
  }

  const call = await prisma.collectionCall.findUnique({
    where: { id: collectionCallId },
    select: { id: true },
  });

  if (!call) {
    return new NextResponse(
      "<?xml version=\"1.0\" encoding=\"UTF-8\"?><Response><Hangup/></Response>",
      { status: 200, headers: { "Content-Type": "text/xml; charset=utf-8" } }
    );
  }

  const sipUri = buildCollectionCallSipUri({
    projectId,
    collectionCallId: call.id,
  });
  const twiml = [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<Response>",
    "<Dial answerOnBridge=\"true\">",
    `<Sip>${xmlEscape(sipUri)}</Sip>`,
    "</Dial>",
    "</Response>",
  ].join("");

  return new NextResponse(twiml, {
    status: 200,
    headers: { "Content-Type": "text/xml; charset=utf-8" },
  });
}

export const GET = handler;
export const POST = handler;
