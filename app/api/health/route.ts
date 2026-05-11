import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDigisacConfig } from "@/lib/services/digisac.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};
  let allOk = true;

  // --- DB ---
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { ok: true };
  } catch (err) {
    checks.db = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    allOk = false;
  }

  // --- Redis ---
  try {
    const url = process.env.REDIS_URL;
    if (!url) {
      checks.redis = { ok: false, detail: "REDIS_URL not set" };
      allOk = false;
    } else {
      const parsed = new URL(url);
      const Redis = (await import("ioredis")).default;
      const client = new Redis(url, { connectTimeout: 5000, lazyConnect: true, maxRetriesPerRequest: 1 });
      await client.connect();
      await client.ping();
      client.disconnect();
      checks.redis = { ok: true, detail: parsed.hostname };
    }
  } catch (err) {
    checks.redis = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    allOk = false;
  }

  // --- QuickBooks token ---
  try {
    const config = await prisma.systemConfig.findUnique({ where: { id: "system" } });
    if (!config?.quickbooks_access_token) {
      checks.qb_token = { ok: false, detail: "No QB token configured" };
      allOk = false;
    } else {
      const expiresAt = config.quickbooks_token_expires_at;
      if (expiresAt && expiresAt < new Date()) {
        checks.qb_token = { ok: false, detail: `Expired at ${expiresAt.toISOString()}` };
        allOk = false;
      } else {
        checks.qb_token = {
          ok: true,
          detail: expiresAt ? `expires ${expiresAt.toISOString()}` : "no expiry stored",
        };
      }
    }
  } catch (err) {
    checks.qb_token = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    allOk = false;
  }

  // --- Digisac ---
  try {
    const config = getDigisacConfig();
    if (!config.enabled) {
      checks.digisac = { ok: false, detail: `Missing: ${config.missing.join(", ")}` };
      allOk = false;
    } else {
      const res = await fetch(`${config.apiBaseUrl}/services/${config.serviceId}`, {
        headers: { Authorization: `Bearer ${config.apiToken}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        checks.digisac = { ok: false, detail: `API ${res.status}` };
        allOk = false;
      } else {
        checks.digisac = { ok: true, detail: `service ${config.serviceId}` };
      }
    }
  } catch (err) {
    checks.digisac = { ok: false, detail: err instanceof Error ? err.message : String(err) };
    allOk = false;
  }

  const status = allOk ? 200 : 503;
  return NextResponse.json({ ok: allOk, checks, ts: new Date().toISOString() }, { status });
}
