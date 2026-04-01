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

  const slaColor = isOverdue
    ? { bar: "bg-red-500", text: "text-red-600", dot: "bg-red-400" }
    : isApproachingSLA
    ? { bar: "bg-amber-400", text: "text-amber-500", dot: "bg-amber-400" }
    : { bar: "bg-gray-200", text: "text-gray-400", dot: "bg-gray-300" };

  const slaPercent = Math.min(Math.round((phaseAgeDays / slaDays) * 100), 100);

  const style = { transform: CSS.Translate.toString(transform) };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`bg-white rounded-xl border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md ${
        isDragging ? "opacity-40 shadow-none" : ""
      }`}
    >
      {/* Name + debtor badge */}
      <div className="flex items-start justify-between gap-1 mb-2.5">
        <span className="text-[13px] font-semibold text-gray-900 truncate leading-tight">
          {enrollment.customer.name}
        </span>
        {isDebtor && (
          <span className="flex-shrink-0 text-[9px] font-bold bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            Débito
          </span>
        )}
      </div>

      {/* Program + assignee */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide ${
            enrollment.programType === "PASS"
              ? "bg-brand-verde/10 text-brand-verde"
              : "bg-brand-tangerina/10 text-brand-tangerina"
          }`}
        >
          {enrollment.programType}
        </span>
        <div
          title={enrollment.assignedTo.name ?? undefined}
          className="w-5 h-5 rounded-full bg-gray-700 flex items-center justify-center text-[9px] font-bold text-white"
        >
          {assigneeInitials}
        </div>
      </div>

      {/* SLA progress bar */}
      <div className="mb-2">
        <div className="h-1 w-full bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${slaColor.bar}`}
            style={{ width: `${slaPercent}%` }}
          />
        </div>
      </div>

      {/* Days + advance */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className={`w-1.5 h-1.5 rounded-full ${slaColor.dot}`} />
          <span className={`text-[11px] font-mono font-medium ${slaColor.text}`}>
            {phaseAgeDays}d / {slaDays}d
          </span>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAdvanceClick(enrollment.id);
          }}
          className="text-[11px] font-semibold text-brand-verde hover:text-white hover:bg-brand-verde px-2 py-0.5 rounded-full transition-all"
        >
          Avançar →
        </button>
      </div>
    </div>
  );
}
