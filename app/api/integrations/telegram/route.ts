import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { telegramService } from "@/lib/services/telegram.service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await telegramService.ping();

  if (!ok) {
    return NextResponse.json({
      connected: false,
      message: "Telegram bot not reachable. Check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID.",
    });
  }

  return NextResponse.json({ connected: true });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ok = await telegramService.ping();
  if (!ok) {
    return NextResponse.json(
      { error: "Bot not reachable. Check env vars." },
      { status: 502 }
    );
  }

  await telegramService.send(
    [
      "🟢 <b>Carreira Hub — Connected</b>",
      "",
      "Telegram alerts are now active.",
      "You will receive:",
      "  • Cron run reports",
      "  • Sync results (QB, Clint)",
      "  • Webhook errors",
      "  • Payment failures",
      "  • System health alerts",
      "",
      `<i>${new Date().toISOString()}</i>`,
    ].join("\n")
  );

  return NextResponse.json({ success: true, message: "Test message sent to Telegram." });
}
