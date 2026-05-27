"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, ExternalLink, FileText, Loader2, Plus } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getTemplate, type FormField } from "@/lib/hub/form-templates";

type FormAnswerMap = Record<string, unknown>;

type FormAssignmentItem = {
  id: string;
  templateId: string;
  status: string;
  assignedAt: string;
  submission: { id: string; submittedAt: string; answers: FormAnswerMap | null } | null;
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

function isEmptyAnswer(value: unknown) {
  return value === null || value === undefined || value === "";
}

function safeDecodeFilename(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function filenameFromValue(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      return safeDecodeFilename(url.pathname.split("/").pop() || url.hostname);
    } catch {
      return value;
    }
  }

  return safeDecodeFilename(value.split("/").pop() || value);
}

function getStorageDownloadHref(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  if (value.startsWith("forms/") || value.startsWith("contracts/") || value.startsWith("ops/")) {
    return `/api/storage/local?key=${encodeURIComponent(value)}&download=1`;
  }

  return null;
}

function getSubmissionFields(templateId: string, answers: FormAnswerMap) {
  const template = getTemplate(templateId);
  const templateFields = template?.fields ?? [];
  const knownIds = new Set(templateFields.map((field) => field.id));
  const extraFields: FormField[] = Object.keys(answers)
    .filter((key) => !knownIds.has(key))
    .map((key) => ({
      id: key,
      type: "text",
      label: key,
      labelPt: key,
      required: false,
    }));

  return [...templateFields, ...extraFields].filter((field) =>
    Object.prototype.hasOwnProperty.call(answers, field.id)
  );
}

function renderAnswerValue(field: FormField, value: unknown) {
  if (isEmptyAnswer(value)) {
    return <span className="italic text-gray-400">Não preenchido</span>;
  }

  if (field.type === "file") {
    const fileValue = String(value);
    const href = getStorageDownloadHref(fileValue);
    if (!href) return <span className="break-all text-gray-700">{fileValue}</span>;

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-8 max-w-full items-center gap-1.5 break-all text-xs font-semibold text-brand-verde hover:underline"
      >
        <Download className="h-3.5 w-3.5 flex-shrink-0" />
        {filenameFromValue(fileValue)}
      </a>
    );
  }

  if (field.type === "checkbox") {
    const checked = value === true || value === "true";
    return <span>{checked ? "Sim" : "Não"}</span>;
  }

  if (field.options?.length) {
    const option = field.options.find((item) => item.value === String(value));
    if (option) return <span>{option.labelPt || option.label}</span>;
  }

  if (Array.isArray(value)) {
    return <span>{value.map(String).join(", ")}</span>;
  }

  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/ops/forms?customerId=${customerId}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
          >
            Central
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            onClick={() => setShowAssignForm((value) => !value)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-tangerina text-white text-xs font-semibold hover:opacity-90 transition-opacity"
          >
            <Plus className="h-3.5 w-3.5" />
            Atribuir Formulário
          </button>
        </div>
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
            const submissionAnswers = assignment.submission?.answers ?? null;
            const fields = submissionAnswers
              ? getSubmissionFields(assignment.templateId, submissionAnswers)
              : [];

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
                {assignment.submission && (
                  <details className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-brand-verde">
                      Ver respostas e arquivos enviados
                    </summary>
                    {fields.length === 0 ? (
                      <p className="mt-3 text-xs text-gray-400">Nenhuma resposta registrada neste envio.</p>
                    ) : (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {fields.map((field) => (
                          <div key={field.id} className="rounded-lg border border-gray-100 bg-white p-3">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                              {field.labelPt || field.label}
                            </p>
                            <div className="mt-1 text-xs leading-relaxed text-gray-700">
                              {renderAnswerValue(field, submissionAnswers?.[field.id])}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <a
                      href={`/dashboard/forms/submissions/${assignment.submission.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex min-h-8 items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-brand-verde hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Abrir tela completa do envio
                    </a>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
