// app/ops/my-tasks/MyTasksClient.tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, PauseCircle, CheckSquare, Square,
  ArrowRight, MessageCircle, FileText, Video, FileCheck,
  Loader2, ChevronRight,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ChecklistItemData {
  key: string;
  label: string;
  type: string;
  autoComplete: boolean;
  requiresAll: boolean;
  completedAt: string | null;
}

interface EnrollmentData {
  enrollmentId: string;
  studentName: string;
  programType: string;
  phaseKey: string;
  phaseLabel: string;
  assigneeName: string | null;
  startDate: string;
  sessionCount: number;
  daysSinceLastSession: number | null;
  checklistProgress: {
    completed: number;
    total: number;
    items: ChecklistItemData[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function urgencyColor(e: EnrollmentData) {
  if (e.daysSinceLastSession !== null && e.daysSinceLastSession >= 14) return "red";
  if (e.daysSinceLastSession !== null && e.daysSinceLastSession >= 7) return "amber";
  return "green";
}

const typeIcon: Record<string, React.ElementType> = {
  whatsapp: MessageCircle,
  form: FileText,
  session: Video,
  doc: FileCheck,
  advance: ChevronRight,
};

const typeBadge: Record<string, string> = {
  whatsapp: "bg-green-100 text-green-700",
  form: "bg-amber-100 text-amber-700",
  session: "bg-blue-100 text-blue-700",
  doc: "bg-purple-100 text-purple-700",
  advance: "bg-gray-100 text-gray-700",
};

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useMyTasks() {
  return useQuery<{ enrollments: EnrollmentData[] }>({
    queryKey: ["my-tasks"],
    queryFn: () => fetch("/api/ops/my-tasks").then((r) => r.json()),
  });
}

function useToggleItem(enrollmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseKey, itemKey, completed }: { phaseKey: string; itemKey: string; completed: boolean }) =>
      fetch(`/api/ops/my-tasks/${enrollmentId}/checklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phaseKey, itemKey, completed }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-tasks"] }),
  });
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function StudentCard({ enrollment, isActive, onClick }: {
  enrollment: EnrollmentData;
  isActive: boolean;
  onClick: () => void;
}) {
  const { completed, total } = enrollment.checklistProgress;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const color = urgencyColor(enrollment);

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${
        isActive ? "border-brand-verde shadow-md" : "border-gray-100 hover:border-brand-verde/40 hover:shadow-sm"
      }`}
    >
      <div className="flex items-center gap-3 p-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          color === "red" ? "bg-red-100 text-red-700" :
          color === "amber" ? "bg-amber-100 text-amber-700" :
          "bg-brand-creme text-brand-verde"
        }`}>
          {initials(enrollment.studentName)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-gray-900 truncate">{enrollment.studentName}</span>
            {color === "red" && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
                <AlertTriangle className="h-2.5 w-2.5" /> {enrollment.daysSinceLastSession}d
              </span>
            )}
            {color === "amber" && (
              <span className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
                <PauseCircle className="h-2.5 w-2.5" /> {enrollment.daysSinceLastSession}d
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-400">{enrollment.phaseLabel} · {enrollment.sessionCount} sessão{enrollment.sessionCount !== 1 ? "ões" : ""}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className={`text-xs font-bold ${pct === 100 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-red-600"}`}>
            {completed}/{total}
          </p>
        </div>
      </div>
      <div className="mx-3 mb-2.5">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${pct === 100 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"}`}
            style={{ width: `${Math.max(pct, pct > 0 ? 6 : 0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function ChecklistPanel({ enrollment }: { enrollment: EnrollmentData }) {
  const toggle = useToggleItem(enrollment.enrollmentId);
  const items = enrollment.checklistProgress.items;
  const allPreviousDone = (idx: number) =>
    items.slice(0, idx).every((i) => i.completedAt !== null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-50 flex items-center gap-3">
        <div className="w-11 h-11 bg-brand-creme rounded-xl flex items-center justify-center text-sm font-bold text-brand-verde flex-shrink-0">
          {initials(enrollment.studentName)}
        </div>
        <div className="flex-1">
          <p className="font-display font-bold text-gray-900 text-lg">{enrollment.studentName}</p>
          <p className="text-xs text-gray-400">{enrollment.phaseLabel} · {enrollment.programType}</p>
        </div>
        <a
          href={`/ops/customers`}
          className="flex items-center gap-1 text-xs font-semibold text-brand-verde hover:text-brand-tangerina transition-colors"
        >
          Ver Perfil <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Checklist */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
            Checklist da Fase
          </p>
          <p className="text-xs font-bold text-gray-500">
            {enrollment.checklistProgress.completed} de {enrollment.checklistProgress.total} concluídas
          </p>
        </div>

        <div className="space-y-1">
          {items.map((item, idx) => {
            const done = item.completedAt !== null;
            const locked = item.requiresAll && !allPreviousDone(idx);
            const TypeIcon = typeIcon[item.type] ?? Square;

            return (
              <div
                key={item.key}
                className={`flex items-start gap-3 p-2.5 rounded-lg transition-colors ${
                  locked ? "opacity-40" : "hover:bg-gray-50"
                }`}
              >
                {/* Checkbox */}
                {item.autoComplete ? (
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    done ? "bg-brand-verde" : "bg-gray-100"
                  }`}>
                    {done && <span className="text-white text-[11px] font-bold">✓</span>}
                  </div>
                ) : (
                  <button
                    disabled={locked || toggle.isPending}
                    onClick={() => toggle.mutate({ phaseKey: enrollment.phaseKey, itemKey: item.key, completed: !done })}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      done ? "bg-brand-verde border-brand-verde" : "border-gray-300 hover:border-brand-verde"
                    } disabled:cursor-not-allowed`}
                  >
                    {done && <span className="text-white text-[11px] font-bold">✓</span>}
                  </button>
                )}

                {/* Label */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${done ? "line-through text-gray-400" : "text-gray-800 font-medium"}`}>
                    {item.label}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeBadge[item.type] ?? "bg-gray-100 text-gray-600"}`}>
                      <TypeIcon className="h-2.5 w-2.5" />
                      {item.type === "whatsapp" ? "WhatsApp" :
                       item.type === "form" ? "Formulário" :
                       item.type === "session" ? "Sessão" :
                       item.type === "doc" ? "Documento" : "Avanço"}
                    </span>
                    {done && item.completedAt && (
                      <span className="text-[10px] text-gray-400">
                        {new Date(item.completedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                    {item.autoComplete && !done && (
                      <span className="text-[10px] text-gray-400 italic">automático</span>
                    )}
                    {locked && (
                      <span className="text-[10px] text-gray-400">aguardando anteriores</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-5">
        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
          <div className="flex-1">
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-verde to-emerald-500 rounded-full transition-all"
                style={{ width: `${enrollment.checklistProgress.total > 0 ? Math.round((enrollment.checklistProgress.completed / enrollment.checklistProgress.total) * 100) : 0}%` }}
              />
            </div>
          </div>
          <p className="text-sm font-bold text-brand-verde flex-shrink-0">
            {enrollment.checklistProgress.total > 0
              ? Math.round((enrollment.checklistProgress.completed / enrollment.checklistProgress.total) * 100)
              : 0}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MyTasksClient() {
  const { data, isLoading } = useMyTasks();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const enrollments = data?.enrollments ?? [];
  const selected = enrollments.find((e) => e.enrollmentId === selectedId) ?? enrollments[0] ?? null;

  const urgent = enrollments.filter((e) => (e.daysSinceLastSession ?? 0) >= 14).length;
  const incomplete = enrollments.filter((e) => e.checklistProgress.completed < e.checklistProgress.total).length;
  const onTrack = enrollments.length - incomplete;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-brand-verde" />
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Alunos na Fase", value: enrollments.length, color: "text-brand-verde" },
          { label: "Incompletos", value: incomplete, color: "text-amber-600" },
          { label: "Precisam Atenção", value: urgent, color: "text-red-600" },
          { label: "Em Dia", value: onTrack, color: "text-emerald-600" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
            <p className={`text-2xl font-display font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {enrollments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
          <CheckSquare className="h-12 w-12 text-gray-200 mx-auto mb-4" />
          <p className="font-display font-semibold text-gray-500">Nenhum aluno na sua fase</p>
          <p className="text-sm text-gray-400 mt-1">O coordenador precisa atribuir fases ao seu perfil.</p>
        </div>
      ) : (
        <div className="flex gap-5">
          {/* Queue */}
          <div className="w-80 flex-shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
              Fila de Alunos · ordenado por prioridade
            </p>
            <div className="space-y-2">
              {enrollments.map((e) => (
                <StudentCard
                  key={e.enrollmentId}
                  enrollment={e}
                  isActive={selected?.enrollmentId === e.enrollmentId}
                  onClick={() => setSelectedId(e.enrollmentId)}
                />
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="flex-1">
            {selected ? (
              <ChecklistPanel enrollment={selected} />
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm">
                <p className="text-sm text-gray-400">Selecione um aluno para ver o checklist</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
