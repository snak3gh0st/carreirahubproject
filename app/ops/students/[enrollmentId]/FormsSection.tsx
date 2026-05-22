"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { FileText, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

type FormAssignmentItem = {
  id: string;
  templateId: string;
  status: string;
  assignedAt: string;
  submission: { id: string; submittedAt: string } | null;
};

type AvailableTemplate = {
  id: string;
  title: string;
  titlePt: string;
};

type NpsResult = {
  templateId: string;
  score: number;
  comment: string | null;
  submittedAt: string;
};

function statusBadgeClass(status: string) {
  switch (status) {
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "IN_PROGRESS":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-yellow-100 text-yellow-700";
  }
}

function statusLabel(status: string) {
  switch (status) {
    case "COMPLETED":
      return "Concluído";
    case "IN_PROGRESS":
      return "Em andamento";
    default:
      return "Pendente";
  }
}

function templateLabel(templateId: string, availableTemplates: AvailableTemplate[]) {
  return availableTemplates.find((template) => template.id === templateId)?.titlePt ?? templateId;
}

export function FormsSection({
  enrollmentId,
  customerId,
  assignments,
  availableTemplates,
  npsResults,
}: {
  enrollmentId: string;
  customerId: string;
  assignments: FormAssignmentItem[];
  availableTemplates: AvailableTemplate[];
  npsResults: NpsResult[];
}) {
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const qc = useQueryClient();

  const activeTemplateIds = useMemo(
    () =>
      new Set(
        assignments
          .filter((assignment) => assignment.status !== "COMPLETED")
          .map((assignment) => assignment.templateId)
      ),
    [assignments]
  );

  const selectableTemplates = availableTemplates.filter(
    (template) => !activeTemplateIds.has(template.id)
  );

  const assignForm = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch("/api/ops/forms/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, templateId }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Erro ao atribuir formulário. Tente novamente.");
      }

      return payload;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-profile", enrollmentId] });
      toast.success("Formulário atribuído com sucesso");
      setSelectedTemplateId("");
      setShowAssignForm(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const npsByTemplate = useMemo(
    () =>
      new Map(
        npsResults.map((result) => [
          result.templateId,
          { score: result.score, comment: result.comment, submittedAt: result.submittedAt },
        ])
      ),
    [npsResults]
  );

  const handleAssign = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTemplateId) return;
    assignForm.mutate(selectedTemplateId);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-base font-display font-semibold text-brand-verde flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Formulários
        </h2>
        <button
          type="button"
          onClick={() => setShowAssignForm((value) => !value)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-tangerina text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          Atribuir Formulário
        </button>
      </div>

      {showAssignForm && (
        <form
          onSubmit={handleAssign}
          className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3"
        >
          <label className="block text-xs font-medium text-gray-600">
            Selecione um formulário
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={selectedTemplateId}
              onChange={(event) => setSelectedTemplateId(event.target.value)}
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-verde/30"
            >
              <option value="">Selecione um formulário...</option>
              {selectableTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.titlePt}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!selectedTemplateId || assignForm.isPending}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand-verde text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {assignForm.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Atribuir
            </button>
          </div>
          {selectableTemplates.length === 0 && (
            <p className="text-xs text-gray-400">
              Todos os formulários disponíveis já estão atribuídos ou em andamento.
            </p>
          )}
        </form>
      )}

      {assignments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center">
          <FileText className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-semibold text-gray-500">Nenhum formulário atribuído</p>
          <p className="text-xs text-gray-400 mt-1">
            Atribua um formulário de entrada ou NPS para este cliente.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {assignments.map((assignment) => {
            const nps = npsByTemplate.get(assignment.templateId);

            return (
              <div key={assignment.id} className="py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {templateLabel(assignment.templateId, availableTemplates)}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Atribuído em {format(new Date(assignment.assignedAt), "dd/MM/yyyy")}
                      {assignment.submission &&
                        ` · Enviado em ${format(
                          new Date(assignment.submission.submittedAt),
                          "dd/MM/yyyy"
                        )}`}
                    </p>
                    {assignment.status === "IN_PROGRESS" && !assignment.submission && (
                      <p className="text-xs text-blue-500 mt-1">Cliente iniciou o preenchimento.</p>
                    )}
                    {nps && (
                      <p className="text-xs text-gray-500 mt-2">
                        NPS: <span className="font-semibold text-brand-verde">{nps.score}/10</span>
                        {nps.comment ? ` · ${nps.comment}` : ""}
                      </p>
                    )}
                  </div>
                  <span
                    className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusBadgeClass(
                      assignment.status
                    )}`}
                  >
                    {statusLabel(assignment.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
