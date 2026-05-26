"use client";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface PhaseDistributionItem {
  label: string;
  key: string;
  count: number;
}

interface NoSessionStudent {
  enrollmentId: string;
  studentName: string;
  phaseLabel: string;
  assigneeName: string;
  daysSinceSession: number | null;
}

interface Debtor {
  enrollmentId: string;
  studentName: string;
  phaseLabel: string;
  assigneeName: string;
  qbBalance: number;
}

interface CoordinatorData {
  phaseDistribution: PhaseDistributionItem[];
  flaggedStudents: unknown[];
  flaggedCount: number;
  noSessionStudents: NoSessionStudent[];
  debtors: Debtor[];
}

async function fetchCoordinator(): Promise<CoordinatorData> {
  const res = await fetch("/api/ops/coordinator");
  if (!res.ok) throw new Error("Failed to fetch coordinator data");
  return res.json();
}

export function PhaseDistribution() {
  const { data, isLoading } = useQuery<CoordinatorData>({
    queryKey: ["coordinator-data"],
    queryFn: fetchCoordinator,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 mt-8">
        <div className="h-6 bg-gray-100 rounded w-48" />
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="px-6 py-3 flex items-center justify-between border-b border-gray-50">
              <div className="h-4 bg-gray-100 rounded w-32" />
              <div className="h-4 bg-gray-100 rounded w-8" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const phases = (data?.phaseDistribution ?? []).filter((p) => p.count > 0);
  const noSessionStudents = data?.noSessionStudents ?? [];
  const debtors = data?.debtors ?? [];

  return (
    <>
      {/* Section A — Phase Distribution */}
      <div className="mt-8 bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-display font-semibold text-brand-verde text-sm">
            Distribuição por Fase
          </h2>
        </div>
        {phases.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {phases.map((phase) => (
              <div key={phase.key} className="px-6 py-3 flex items-center justify-between">
                <span className="text-sm text-gray-700">{phase.label}</span>
                <span className="text-sm font-semibold text-brand-verde">{phase.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-6 py-8 text-center">
            <p className="text-sm text-gray-400">Nenhum cliente ativo nas fases.</p>
          </div>
        )}
      </div>

      {/* Section B — No-session students */}
      <h2 className="text-sm font-display font-semibold text-brand-verde mt-8 mb-4">
        Clientes sem Sessão Recente
      </h2>
      {noSessionStudents.length === 0 ? (
        <p className="text-sm text-gray-400">Todos os clientes tiveram sessão recente.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {noSessionStudents.map((student) => (
            <div
              key={student.enrollmentId}
              className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">
                Sem sessão
              </span>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/ops/students/${student.enrollmentId}`}
                  className="font-semibold text-sm text-gray-900 hover:text-brand-verde transition-colors"
                >
                  {student.studentName}
                </Link>
                <p className="text-xs text-gray-500">{student.phaseLabel}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                {student.daysSinceSession !== null ? (
                  <span className="text-[11px] font-mono font-medium text-amber-600">
                    Última sessão há {student.daysSinceSession}d
                  </span>
                ) : (
                  <span className="text-[11px] font-mono font-medium text-amber-600">
                    Sem sessão registrada
                  </span>
                )}
                <p className="text-xs text-gray-400">{student.assigneeName}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}

      {/* Section C — Debtors */}
      <h2 className="text-sm font-display font-semibold text-brand-verde mt-8 mb-4">
        Clientes com Débito QB
      </h2>
      {debtors.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhum cliente com débito em aberto.</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {debtors.map((debtor) => (
            <div
              key={debtor.enrollmentId}
              className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-[10px] font-bold bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide flex-shrink-0">
                Débito
              </span>
              <div className="flex-1 min-w-0">
                <Link
                  href={`/ops/students/${debtor.enrollmentId}`}
                  className="font-semibold text-sm text-gray-900 hover:text-brand-verde transition-colors"
                >
                  {debtor.studentName}
                </Link>
                <p className="text-xs text-gray-500">{debtor.phaseLabel}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <span className="text-sm font-semibold text-red-500">
                  ${debtor.qbBalance.toFixed(2)}
                </span>
                <p className="text-xs text-gray-400">{debtor.assigneeName}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
