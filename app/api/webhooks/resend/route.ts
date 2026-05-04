import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/db";
import { NotificationStatus } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/resend
 *
 * Receives delivery events from Resend and updates notification status.
 * Requires RESEND_WEBHOOK_SECRET (set in Resend Dashboard → Webhooks).
 *
 * Handled events:
 *   email.delivered  → SENT (confirmed delivery)
 *   email.bounced    → BOUNCED
 *   email.complained → BOUNCED (spam complaint treated same as bounce)
 */
export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[Resend Webhook] RESEND_WEBHOOK_SECRET not configured");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const rawBody = await request.text();
  const svixId = request.headers.get("svix-id") ?? "";
  const svixTimestamp = request.headers.get("svix-timestamp") ?? "";
  const svixSignature = request.headers.get("svix-signature") ?? "";

  let event: any;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err: any) {
    console.error("[Resend Webhook] Signature verification failed:", err.message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { type, data } = event as { type: string; data: any };
  const resendId: string | undefined = data?.email_id;

  console.log(`[Resend Webhook] event=${type} resend_id=${resendId}`);

  if (!resendId) {
    return NextResponse.json({ ok: true });
  }

  try {
    if (type === "email.delivered") {
      await prisma.notification.updateMany({
        where: { resendId, status: { not: NotificationStatus.BOUNCED } },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } else if (type === "email.bounced" || type === "email.complained") {
      const bounceMsg =
        type === "email.complained"
          ? "Spam complaint"
          : data?.bounce?.message ?? "Bounced";

      await prisma.notification.updateMany({
        where: { resendId },
        data: {
          status: NotificationStatus.BOUNCED,
          bouncedAt: new Date(),
          errorMessage: bounceMsg,
        },
      });

      console.warn(
        `[Resend Webhook] ${type} for resend_id=${resendId}: ${bounceMsg}`
      );
    }
  } catch (err: any) {
    console.error("[Resend Webhook] DB update failed:", err.message);
    // Return 200 so Resend doesn't retry — the event is logged above
  }

  return NextResponse.json({ ok: true });
}
