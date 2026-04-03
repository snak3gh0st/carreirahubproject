"use client";

import { useQuery } from "@tanstack/react-query";
import { FormsSection } from "./FormsSection";
import { SessionSection } from "./SessionSection";
import { ArrowLeft, User, GraduationCap, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

type ProfileData = {
  enrollment: {
    id: string;
    programType: string;
    status: string;
    startDate: string;
    customer: { id: string; name: string; email: string; phone: string | null };
    currentPhase: { label: string; sortOrder: number } | null;
    assignedTo: { id: string; name: string };
    transitions: Array<{
      id: string;
      createdAt: string;
      fromPhase: { label: string } | null;
      toPhase: { label: string };
      triggeredBy: { name: string };
    }>;
    sessions: Array<{
      id: string;
      sessionType: string;
      sessionDate: string;
      notes: string | null;
      conductor: { name: string };
    }>;
    formAssignments: Array<{
      id: string;
      templateId: string;
      status: string;
      assignedAt: string;
      submission: { id: string; submittedAt: string } | null;
    }>;
  };
  placementTest: {
    cefrLevel: string;
    displayLevel: string;
    percentage: number;
    createdAt: string;
  } | null;
  totalSessions: number;
  availableFormTemplates: Array<{
    id: string;
    title: string;
    titlePt: string;
  }>;
  npsResults: Array<{
    templateId: string;
    score: number;
    comment: string | null;
    submittedAt: string;
  }>;
};

function useProfileData(enrollmentId: string) {
  return useQuery<ProfileData>({
    queryKey: ["student-profile", enrollmentId],
    queryFn: () =>
      fetch(`/api/ops/enrollments/${enrollmentId}`).then((r) => r.json()),
  });
}

export function StudentProfileClient({
  enrollmentId,
  currentUserId,
}: {
  enrollmentId: string;
  currentUserId: string;
}) {
  const { data, isLoading, error } = useProfileData(enrollmentId);

  if (isLoading) return <div className="p-8 text-sm text-gray-400">Carregando perfil...</div>;
  if (error || !data?.enrollment) {
    return <div className="p-8 text-sm text-red-500">Erro ao carregar perfil do aluno.</div>;
  }

  const { enrollment, placementTest, totalSessions } = data;

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Back nav */}
      <Link
        href="/ops/pipeline"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-verde transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao Pipeline
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-brand-verde/10 flex items-center justify-center">
              <User className="h-6 w-6 text-brand-verde" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold text-brand-verde">
                {enrollment.customer.name}
              </h1>
              <p className="text-sm text-gray-500">{enrollment.customer.email}</p>
              {enrollment.customer.phone && (
                <p className="text-sm text-gray-400">{enrollment.customer.phone}</p>
              )}
            </div>
          </div>
          <span
            className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${
              enrollment.programType === "ADVANCED"
                ? "bg-purple-50 text-purple-700"
                : "bg-blue-50 text-blue-700"
            }`}
          >
            {enrollment.programType}
          </span>
        </div>

        <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Fase Atual</p>
            <p className="text-sm font-medium text-gray-800 mt-1">
              {enrollment.currentPhase?.label ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Responsável</p>
            <p className="text-sm font-medium text-gray-800 mt-1">{enrollment.assignedTo.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Início</p>
            <p className="text-sm font-medium text-gray-800 mt-1">
              {format(new Date(enrollment.startDate), "dd/MM/yyyy")}
            </p>
          </div>
          {placementTest && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-medium flex items-center gap-1">
                <GraduationCap className="h-3.5 w-3.5" />
                Inglês (CEFR)
              </p>
              <p className="text-sm font-semibold text-brand-verde mt-1">
                {placementTest.displayLevel}{" "}
                <span className="text-xs text-gray-400 font-normal">
                  ({Math.round(placementTest.percentage)}%)
                </span>
              </p>
            </div>
          )}
        </div>

        {data.npsResults.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.npsResults.map((result) => (
              <span
                key={result.templateId}
                className="inline-flex items-center gap-1 rounded-full bg-brand-verde px-3 py-1 text-xs font-semibold text-brand-creme"
              >
                {result.templateId === "nps-entry" ? "NPS Entrada" : "NPS Saída"}: {result.score}/10
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Phase timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6">
        <h2 className="text-base font-display font-semibold text-brand-verde mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de Fases
        </h2>
        {enrollment.transitions.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma transição registrada ainda.</p>
        ) : (
          <ol className="relative border-l border-gray-200 space-y-4 pl-6">
            {enrollment.transitions.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full bg-brand-verde/20 border-2 border-brand-verde" />
                <p className="text-sm font-medium text-gray-800">
                  {t.fromPhase ? `${t.fromPhase.label} → ` : "Início → "}
                  {t.toPhase.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {format(new Date(t.createdAt), "dd/MM/yyyy 'às' HH:mm")} · {t.triggeredBy.name}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <FormsSection
        enrollmentId={enrollmentId}
        customerId={enrollment.customer.id}
        assignments={enrollment.formAssignments}
        availableTemplates={data.availableFormTemplates}
        npsResults={data.npsResults}
      />

      {/* Session log + form — rendered by SessionSection (Plan 02) */}
      <SessionSection
        enrollmentId={enrollmentId}
        initialSessions={enrollment.sessions}
        totalSessions={totalSessions}
        currentUserId={currentUserId}
      />
    </div>
  );
}
