"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity, FileClock, RefreshCw, Send, Zap } from "lucide-react";

const ACTIONS = [
  {
    job: "process-queue",
    label: "Processar filas",
    detail: "Roda BullMQ agora",
    icon: Zap,
  },
  {
    job: "refresh-qb-token",
    label: "Renovar QB token",
    detail: "Força refresh OAuth",
    icon: RefreshCw,
  },
  {
    job: "quickbooks-sync",
    label: "Sync QuickBooks",
    detail: "Clientes, invoices e pagamentos",
    icon: Activity,
  },
  {
    job: "send-scheduled-invoices",
    label: "Enviar invoices",
    detail: "Dispara invoices agendadas",
    icon: Send,
  },
  {
    job: "health-digest",
    label: "Health Digest",
    detail: "Envia digest Telegram",
    icon: FileClock,
  },
] as const;

type RunResult = {
  job: string;
  success: boolean;
  status?: number;
  durationMs?: number;
  error?: string;
};

export function AdminHealthActions() {
  const [runningJob, setRunningJob] = useState<string | null>(null);
  const [result, setResult] = useState<RunResult | null>(null);

  async function runJob(job: string) {
    setRunningJob(job);
    setResult(null);

    try {
      const response = await fetch("/api/admin/cron/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = await response.json();
      setResult({
        job,
        success: response.ok && data.success !== false,
        status: data.status || response.status,
        durationMs: data.durationMs,
        error: data.error,
      });
    } catch (error) {
      setResult({
        job,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRunningJob(null);
    }
  }

  return (
    <section className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">Operational Actions</h2>
          <p className="text-sm text-gray-500">
            Execução manual segura para resolver filas, tokens, syncs e digest sem sair do Hub Admin.
          </p>
        </div>
        <Link
          href="/dashboard/admin/ops-control"
          className="inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Abrir Ops Control Center
        </Link>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isRunning = runningJob === action.job;
          return (
            <button
              key={action.job}
              type="button"
              onClick={() => runJob(action.job)}
              disabled={!!runningJob}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-left transition hover:border-brand-verde hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="mb-3 flex items-center justify-between">
                <Icon className="h-5 w-5 text-brand-verde" />
                {isRunning && <RefreshCw className="h-4 w-4 animate-spin text-gray-400" />}
              </div>
              <p className="text-sm font-semibold text-gray-950">{action.label}</p>
              <p className="mt-1 text-xs text-gray-500">{action.detail}</p>
            </button>
          );
        })}
      </div>

      {result && (
        <div
          className={`mt-4 rounded-md border px-3 py-2 text-sm ${
            result.success
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {result.success ? "Executado" : "Falhou"}: {result.job}
          {result.status ? ` · HTTP ${result.status}` : ""}
          {result.durationMs ? ` · ${Math.round(result.durationMs / 1000)}s` : ""}
          {result.error ? ` · ${result.error}` : ""}
        </div>
      )}
    </section>
  );
}
