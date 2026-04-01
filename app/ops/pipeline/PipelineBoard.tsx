"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  rectIntersection,
  useDroppable,
} from "@dnd-kit/core";
import { useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { usePipelineData, useAdvancePhase } from "./usePipelineData";
import type { EnrollmentCard, PhaseWithEnrollments } from "./usePipelineData";
import { StudentCard } from "./StudentCard";
import { AdvanceDialog, PendingMove } from "./AdvanceDialog";

interface PipelineBoardProps {
  currentUserId: string;
  currentUserName: string;
}

interface PhaseColumnProps {
  phase: PhaseWithEnrollments;
  enrollments: EnrollmentCard[];
  onAdvanceClick: (enrollmentId: string) => void;
}

function PhaseColumn({ phase, enrollments, onAdvanceClick }: PhaseColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: phase.id });

  const hasStudents = enrollments.length > 0;

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-56 flex flex-col rounded-2xl border transition-all duration-150 ${
        isOver
          ? "border-brand-verde/40 bg-brand-verde/5 shadow-md"
          : "border-gray-200 bg-white shadow-sm"
      }`}
    >
      {/* Column header */}
      <div className="px-4 pt-4 pb-3 border-b border-gray-100 flex items-center justify-between gap-2">
        <h3 className="text-xs font-display font-bold text-gray-700 truncate uppercase tracking-wider leading-tight">
          {phase.label}
        </h3>
        <span
          className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
            hasStudents
              ? "bg-brand-verde text-white"
              : "bg-gray-100 text-gray-400"
          }`}
        >
          {enrollments.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-3 space-y-2 min-h-[120px]">
        {enrollments.map((e) => (
          <StudentCard
            key={e.id}
            enrollment={e}
            slaDays={phase.slaDays}
            onAdvanceClick={onAdvanceClick}
          />
        ))}
        {!hasStudents && (
          <div className="h-16 flex items-center justify-center">
            <span className="text-[11px] text-gray-300 select-none">Vazio</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from({ length: 11 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-56 h-80 bg-white rounded-2xl border border-gray-200 animate-pulse" />
      ))}
    </div>
  );
}

export function PipelineBoard({ currentUserId }: PipelineBoardProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const isMyStudents = searchParams.get("assignee") === "me";

  const { data: phases, isLoading, isError, refetch } = usePipelineData();
  const advanceMutation = useAdvancePhase();

  const [activeEnrollmentId, setActiveEnrollmentId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);

  function toggleFilter() {
    const params = new URLSearchParams(searchParams.toString());
    if (isMyStudents) {
      params.delete("assignee");
    } else {
      params.set("assignee", "me");
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function findEnrollmentPhase(enrollmentId: string) {
    if (!phases) return null;
    for (const phase of phases) {
      const enrollment = phase.enrollments.find((e) => e.id === enrollmentId);
      if (enrollment) return { phase, enrollment };
    }
    return null;
  }

  function handleAdvanceClick(enrollmentId: string) {
    if (!phases) return;
    const found = findEnrollmentPhase(enrollmentId);
    if (!found) return;
    const { phase: currentPhase, enrollment } = found;
    const nextPhase = phases.find((p) => p.sortOrder === currentPhase.sortOrder + 1);
    if (!nextPhase) {
      toast.error("Este aluno já está na última fase.");
      return;
    }
    setPendingMove({
      enrollmentId,
      studentName: enrollment.customer.name,
      toPhaseId: nextPhase.id,
      toPhaseLabel: nextPhase.label,
    });
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveEnrollmentId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveEnrollmentId(null);
    const { active, over } = event;
    if (!over || !phases) return;

    const enrollmentId = active.id as string;
    const targetPhaseId = over.id as string;

    const found = findEnrollmentPhase(enrollmentId);
    if (!found) return;
    const { phase: currentPhase, enrollment } = found;

    const targetPhase = phases.find((p) => p.id === targetPhaseId);
    if (!targetPhase) return;

    if (targetPhase.sortOrder !== currentPhase.sortOrder + 1) return;

    setPendingMove({
      enrollmentId,
      studentName: enrollment.customer.name,
      toPhaseId: targetPhase.id,
      toPhaseLabel: targetPhase.label,
    });
  }

  function handleConfirm() {
    if (!pendingMove) return;
    const { enrollmentId, toPhaseId } = pendingMove;
    setPendingMove(null);
    advanceMutation.mutate(
      { enrollmentId, toPhaseId },
      {
        onSuccess: () => toast.success("Fase avançada com sucesso"),
        onError: (err) => toast.error(err.message ?? "Erro ao avançar fase"),
      }
    );
  }

  function handleCancel() {
    setPendingMove(null);
  }

  const activeEnrollment = activeEnrollmentId
    ? (() => {
        const found = findEnrollmentPhase(activeEnrollmentId);
        return found ? { enrollment: found.enrollment, slaDays: found.phase.slaDays } : null;
      })()
    : null;

  const totalStudents = phases?.reduce((sum, p) => sum + p.enrollments.length, 0) ?? 0;

  if (isLoading) return <PipelineSkeleton />;

  if (isError || !phases) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-sm text-gray-500">Erro ao carregar o pipeline.</p>
        <button
          onClick={() => refetch()}
          className="text-sm font-medium text-brand-verde underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-brand-verde">{totalStudents}</span> aluno{totalStudents !== 1 ? "s" : ""} ativo{totalStudents !== 1 ? "s" : ""}
          {" · "}
          <span className="font-semibold text-brand-verde">{phases.length}</span> fases
        </p>
        <button
          onClick={toggleFilter}
          className={`text-xs font-semibold rounded-full px-4 py-1.5 transition-all border ${
            isMyStudents
              ? "bg-brand-verde text-white border-brand-verde shadow-sm"
              : "border-gray-200 text-gray-600 hover:border-brand-verde hover:text-brand-verde bg-white"
          }`}
        >
          {isMyStudents ? "Todos os alunos" : "Meus alunos"}
        </button>
      </div>

      <DndContext
        collisionDetection={rectIntersection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-6" style={{ minHeight: "400px" }}>
          {phases.map((phase) => {
            const visibleEnrollments = isMyStudents
              ? phase.enrollments.filter((e) => e.assignedTo.id === currentUserId)
              : phase.enrollments;

            return (
              <PhaseColumn
                key={phase.id}
                phase={phase}
                enrollments={visibleEnrollments}
                onAdvanceClick={handleAdvanceClick}
              />
            );
          })}
        </div>

        <DragOverlay style={{ zIndex: 50 }}>
          {activeEnrollment ? (
            <div className="rotate-2 shadow-2xl">
              <StudentCard
                enrollment={activeEnrollment.enrollment}
                slaDays={activeEnrollment.slaDays}
                onAdvanceClick={() => {}}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <AdvanceDialog
        pending={pendingMove}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isLoading={advanceMutation.isPending}
      />
    </div>
  );
}
