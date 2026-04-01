"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { differenceInDays } from "date-fns";
import type { EnrollmentCard } from "./usePipelineData";

interface StudentCardProps {
  enrollment: EnrollmentCard;
  slaDays: number;
  onAdvanceClick: (enrollmentId: string) => void;
}

export function StudentCard({ enrollment, slaDays, onAdvanceClick }: StudentCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: enrollment.id,
  });

  const lastTransition = enrollment.transitions[0];
  const phaseAgeDays = lastTransition
    ? differenceInDays(new Date(), new Date(lastTransition.createdAt))
    : 0;
  const isOverdue = phaseAgeDays > slaDays;
  const isApproachingSLA = !isOverdue && phaseAgeDays > slaDays * 0.75;
  const isDebtor =
    enrollment.customer.qbBalance !== null &&
    Number(enrollment.customer.qbBalance) > 0;

  const assigneeInitials = enrollment.assignedTo.name
    ? enrollment.assignedTo.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "?";

  const borderColor = isOverdue
    ? "border-l-red-500"
    : isApproachingSLA
    ? "border-l-amber-400"
    : "border-l-transparent";

  const ageColor = isOverdue
    ? "text-red-600"
    : isApproachingSLA
    ? "text-amber-500"
    : "text-gray-400";

  const style = {
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${borderColor} p-3 shadow-sm cursor-grab active:cursor-grabbing select-none ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      {/* Top row: name + debtor badge */}
      <div className="flex items-start justify-between gap-1 mb-2">
        <span className="text-sm font-medium text-gray-900 truncate leading-tight">
          {enrollment.customer.name}
        </span>
        {isDebtor && (
          <span className="flex-shrink-0 text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded">
            Devedor
          </span>
        )}
      </div>

      {/* Middle row: program badge + assignee */}
      <div className="flex items-center justify-between mb-2">
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
            enrollment.programType === "PASS"
              ? "bg-brand-verde/10 text-brand-verde"
              : "bg-brand-tangerina/10 text-brand-tangerina"
          }`}
        >
          {enrollment.programType}
        </span>
        <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
          {assigneeInitials}
        </div>
      </div>

      {/* Bottom row: phase age + advance button */}
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-mono ${ageColor}`}>
          {phaseAgeDays}d
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdvanceClick(enrollment.id);
          }}
          className="text-[11px] font-medium text-brand-verde hover:text-brand-verde/70 transition-colors"
        >
          Avançar →
        </button>
      </div>
    </div>
  );
}
