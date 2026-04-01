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

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-52 bg-gray-50 rounded-xl p-3 transition-colors ${
        isOver ? "bg-brand-verde/5 ring-2 ring-brand-verde/30" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-display font-semibold text-gray-700 truncate">
          {phase.label}
        </h3>
        <span className="text-xs text-gray-400 font-mono">{enrollments.length}</span>
      </div>
      <div className="space-y-2 min-h-[4rem]">
        {enrollments.map((e) => (
          <StudentCard
            key={e.id}
            enrollment={e}
            slaDays={phase.slaDays}
            onAdvanceClick={onAdvanceClick}
          />
        ))}
      </div>
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: 11 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-52 h-96 bg-gray-100 rounded-xl animate-pulse" />
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

    // Only allow advance to adjacent next phase
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
      {/* Filter toggle */}
      <div className="mb-4">
        <button
          onClick={toggleFilter}
          className={`text-sm border rounded-lg px-3 py-1.5 font-medium transition-colors ${
            isMyStudents
              ? "bg-brand-verde text-white border-brand-verde"
              : "border-gray-300 text-gray-600 hover:border-brand-verde"
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
        <div className="flex gap-4 overflow-x-auto pb-6">
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
            <div className="rotate-2 shadow-xl">
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
