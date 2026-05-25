import { NextRequest, NextResponse } from "next/server";
import { collectionCallService } from "@/lib/services/collection-call.service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const collectionCallId = request.nextUrl.searchParams.get("collectionCallId");
  if (!collectionCallId) {
    return NextResponse.json({ error: "collectionCallId is required" }, { status: 400 });
  }

  const form = await request.formData();
  await collectionCallService.handleTwilioStatusCallback({
    collectionCallId,
    callSid: String(form.get("CallSid") || ""),
    callStatus: String(form.get("CallStatus") || ""),
    callDuration: String(form.get("CallDuration") || ""),
  });

  return NextResponse.json({ received: true });
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "collection-call-twilio-status" });
}
