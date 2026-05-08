import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { telegramService } from "@/lib/services/telegram.service";
import { withCronTelemetry } from "@/lib/utils/cron-with-telegram";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export const GET = withCronTelemetry("health-digest", async (request: NextRequest) => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // ── IntegrationLog last 24h summary ──────────────────────────────────────
  const logs = await prisma.integrationLog.groupBy({
    by: ["service", "status"],
    where: { createdAt: { gte: since } },
    _count: { id: true },
  });

  const byService: Record<string, { ok: number; err: number }> = {};
  let totalOk = 0;
  let totalErr = 0;
  for (const row of logs) {
    const svc = row.service;
    if (!byService[svc]) byService[svc] = { ok: 0, err: 0 };
    if (row.status === "SUCCESS" || row.status === "success") {
      byService[svc].ok += row._count.id;
      totalOk += row._count.id;
    } else {
      byService[svc].err += row._count.id;
      totalErr += row._count.id;
    }
  }

  // ── /api/health inline check ──────────────────────────────────────────────
  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  let health: { ok: boolean; checks: Record<string, { ok: boolean; detail?: string }> } = {
    ok: false,
    checks: {},
  };
  try {
    const res = await fetch(`${baseUrl}/api/health`, { cache: "no-store" });
    health = await res.json();
  } catch {
    health = { ok: false, checks: { fetch: { ok: false, detail: "failed to reach /api/health" } } };
  }

  // ── Build Telegram message ────────────────────────────────────────────────
  const statusEmoji = health.ok && totalErr === 0 ? "✅" : "⚠️";
  const lines: string[] = [
    `${statusEmoji} <b>CarreiraHub — Daily Health Digest</b>`,
    "",
    "<b>Infrastructure</b>",
  ];

  for (const [key, check] of Object.entries(health.checks)) {
    const icon = check.ok ? "🟢" : "🔴";
    const detail = check.detail ? ` — ${esc(check.detail)}` : "";
    lines.push(`${icon} ${esc(key)}${detail}`);
  }

  lines.push("", "<b>Last 24h runs</b>");
  lines.push(`• Total: ${totalOk + totalErr} (✅ ${totalOk} · ❌ ${totalErr})`);

  const errServices = Object.entries(byService)
    .filter(([, v]) => v.err > 0)
    .sort((a, b) => b[1].err - a[1].err);

  if (errServices.length > 0) {
    lines.push("", "<b>Services with errors</b>");
    for (const [svc, counts] of errServices) {
      lines.push(`• ${esc(svc)}: ❌ ${counts.err} / ${counts.ok + counts.err}`);
    }
  }

  lines.push("", `<i>${new Date().toISOString()}</i>`);

  await telegramService.send(lines.join("\n"), { parse_mode: "HTML" });

  return NextResponse.json({
    success: true,
    healthOk: health.ok,
    totalRuns: totalOk + totalErr,
    totalOk,
    totalErr,
  });
});

export const POST = GET;
