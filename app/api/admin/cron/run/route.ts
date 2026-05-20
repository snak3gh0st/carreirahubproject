import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ADMIN_HEALTH_CRON_JOBS } from "@/lib/admin/system-health";

export const dynamic = "force-dynamic";

const MANUAL_CRON_ALLOWLIST = new Set([
  "process-queue",
  "refresh-qb-token",
  "quickbooks-sync",
  "clint-sync",
  "send-scheduled-invoices",
  "invoice-payment-reminder",
  "overdue-invoices",
  "overdue-invoice-alerts",
  "collection-calls",
  "contract-expiration",
  "form-completion-reminder",
  "health-digest",
  "ops-daily-digest",
]);

function extractCronErrorMessage(data: unknown, status: number) {
  if (typeof data === "string" && data.trim()) {
    return data.trim().slice(0, 500);
  }

  if (data && typeof data === "object") {
    const error = "error" in data && typeof data.error === "string" ? data.error : null;
    if (error?.trim()) return error.trim();

    const message = "message" in data && typeof data.message === "string" ? data.message : null;
    if (message?.trim()) return message.trim();

    const nested = "data" in data ? (data as { data?: unknown }).data : null;
    if (nested && typeof nested === "object") {
      const nestedError =
        "error" in nested && typeof nested.error === "string" ? nested.error : null;
      if (nestedError?.trim()) return nestedError.trim();

      const nestedMessage =
        "message" in nested && typeof nested.message === "string" ? nested.message : null;
      if (nestedMessage?.trim()) return nestedMessage.trim();
    }
  }

  return `HTTP ${status}`;
}

function getBaseUrl(request: NextRequest) {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXTAUTH_URL ||
    process.env.APP_URL;

  return (configured || request.nextUrl.origin).replace(/\/$/, "");
}

async function invokeCronJob(url: string, cronSecret: string, signal: AbortSignal) {
  const headers = {
    Authorization: `Bearer ${cronSecret}`,
    "x-vercel-cron-secret": cronSecret,
  };

  let response = await fetch(url, {
    method: "POST",
    headers,
    cache: "no-store",
    signal,
  });

  if (response.status === 405) {
    response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store",
      signal,
    });
  }

  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text.slice(0, 2000);
  }

  return { response, data };
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || (session.user as any).role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET missing. Manual run disabled." },
      { status: 500 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const jobName = String(body.job || "");
  const job = ADMIN_HEALTH_CRON_JOBS.find((item) => item.name === jobName);

  if (!job || !MANUAL_CRON_ALLOWLIST.has(job.name)) {
    return NextResponse.json({ error: "Cron job is not allowed for manual execution." }, { status: 400 });
  }

  const start = Date.now();
  const controller = new AbortController();
  const timeoutMs = job.name === "clint-sync" ? 20 * 60 * 1000 : 5 * 60 * 1000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const { response, data } = await invokeCronJob(
      `${getBaseUrl(request)}${job.route}`,
      cronSecret,
      controller.signal
    );

    return NextResponse.json({
      success: response.ok,
      job: job.name,
      label: job.label,
      route: job.route,
      status: response.status,
      durationMs: Date.now() - start,
      error: response.ok ? undefined : extractCronErrorMessage(data, response.status),
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        job: job.name,
        label: job.label,
        route: job.route,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  } finally {
    clearTimeout(timeout);
  }
}
