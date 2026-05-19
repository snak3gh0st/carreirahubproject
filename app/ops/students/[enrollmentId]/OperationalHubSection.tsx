"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  Link2,
  Plus,
  Save,
  Upload,
} from "lucide-react";

type OpsProfile = {
  id: string;
  optStatus: string | null;
  coachCohort: string | null;
  classAttendancePercent: number | null;
  boardUrl: string | null;
  notionUrl: string | null;
  linkedinUrl: string | null;
  interviewRecordingFolderUrl: string | null;
  contractPdfKey: string | null;
  renewalDate: string | null;
  renewalState: string;
  lastOperationalContactAt: string | null;
  notes: string | null;
} | null;

type OpsDocument = {
  id: string;
  kind: string;
  status: string;
  title: string | null;
  filename: string;
  storageKey: string;
  version: number;
  uploadedAt: string;
  reviewedAt: string | null;
  finalizedAt: string | null;
  uploadedBy: { name: string } | null;
  reviewedBy: { name: string } | null;
};

type OpsActivity = {
  id: string;
  type: string;
  activityDate: string;
  company: string | null;
  roleTitle: string | null;
  area: string | null;
  industry: string | null;
  source: string | null;
  outcome: string | null;
  notes: string | null;
  createdBy: { name: string } | null;
};

const DOCUMENT_KINDS = [
  ["CV_ORIGINAL", "CV original"],
  ["CV_FINAL", "CV final"],
  ["MATERIAL", "Material"],
  ["CONTRACT_PDF", "Contrato PDF"],
  ["FORM_PDF", "Formulário PDF"],
  ["OTHER", "Outro"],
] as const;

const DOCUMENT_STATUSES = [
  ["UPLOADED", "Recebido"],
  ["PARSED", "Texto extraído"],
  ["NEEDS_REVIEW", "Precisa revisão"],
  ["REVIEWED", "Revisado"],
  ["FINAL", "Final"],
] as const;

const ACTIVITY_TYPES = [
  ["APPLICATION", "Aplicação"],
  ["INTERVIEW", "Entrevista"],
  ["OFFER", "Oferta"],
  ["JOB_PLACED", "Recolocação"],
  ["VACANCY_REVIEW", "Análise de vaga"],
  ["MOCK_INTERVIEW", "Mock interview"],
  ["SUPPORT_SALE", "Venda suporte"],
  ["OTHER", "Outro"],
] as const;

function dateInput(value: string | null | undefined) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function formatKind(value: string) {
  return DOCUMENT_KINDS.find(([key]) => key === value)?.[1] ?? value;
}

function formatActivity(value: string) {
  return ACTIVITY_TYPES.find(([key]) => key === value)?.[1] ?? value;
}

export function OperationalHubSection({
  enrollmentId,
  profile,
  documents,
  activities,
}: {
  enrollmentId: string;
  customerId: string;
  profile: OpsProfile;
  documents: OpsDocument[];
  activities: OpsActivity[];
}) {
  const qc = useQueryClient();
  const [profileState, setProfileState] = useState({
    optStatus: profile?.optStatus ?? "",
    coachCohort: profile?.coachCohort ?? "",
    classAttendancePercent: profile?.classAttendancePercent?.toString() ?? "",
    renewalDate: dateInput(profile?.renewalDate),
    renewalState: profile?.renewalState ?? "NOT_DUE",
    lastOperationalContactAt: dateInput(profile?.lastOperationalContactAt),
    boardUrl: profile?.boardUrl ?? "",
    notionUrl: profile?.notionUrl ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
    interviewRecordingFolderUrl: profile?.interviewRecordingFolderUrl ?? "",
    contractPdfKey: profile?.contractPdfKey ?? "",
    notes: profile?.notes ?? "",
  });
  const [documentState, setDocumentState] = useState({
    kind: "CV_ORIGINAL",
    status: "UPLOADED",
    title: "",
    extractedText: "",
    notes: "",
    file: null as File | null,
  });
  const [activityState, setActivityState] = useState({
    type: "APPLICATION",
    activityDate: new Date().toISOString().slice(0, 10),
    company: "",
    roleTitle: "",
    area: "",
    industry: "",
    source: "",
    outcome: "",
    notes: "",
  });

  const latestFinalCv = useMemo(
    () => documents.find((document) => document.kind === "CV_FINAL" && document.status === "FINAL"),
    [documents]
  );

  const saveProfile = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/enrollments/${enrollmentId}/ops-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileState),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao salvar perfil operacional");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-profile", enrollmentId] });
      toast.success("Perfil operacional salvo.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const uploadDocument = useMutation({
    mutationFn: async () => {
      if (!documentState.file) throw new Error("Selecione um arquivo.");
      const formData = new FormData();
      formData.set("file", documentState.file);
      formData.set("kind", documentState.kind);
      formData.set("status", documentState.status);
      formData.set("title", documentState.title);
      formData.set("extractedText", documentState.extractedText);
      formData.set("notes", documentState.notes);
      const res = await fetch(`/api/ops/enrollments/${enrollmentId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao subir documento");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-profile", enrollmentId] });
      setDocumentState({
        kind: "CV_ORIGINAL",
        status: "UPLOADED",
        title: "",
        extractedText: "",
        notes: "",
        file: null,
      });
      toast.success("Documento salvo no Hub.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addActivity = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ops/enrollments/${enrollmentId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activityState),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Erro ao registrar atividade");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student-profile", enrollmentId] });
      setActivityState({
        type: "APPLICATION",
        activityDate: new Date().toISOString().slice(0, 10),
        company: "",
        roleTitle: "",
        area: "",
        industry: "",
        source: "",
        outcome: "",
        notes: "",
      });
      toast.success("Atividade registrada.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-display font-semibold text-brand-verde">
                Perfil operacional
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Dados internos usados por pipeline, renovação, materiais e mock interviews.
              </p>
            </div>
            <button
              type="button"
              onClick={() => saveProfile.mutate()}
              disabled={saveProfile.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-brand-verde text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {saveProfile.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-medium text-gray-600">
              OPT
              <select
                value={profileState.optStatus}
                onChange={(e) => setProfileState((s) => ({ ...s, optStatus: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Não informado</option>
                <option value="YES">Sim</option>
                <option value="NO">Não</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Turma
              <input
                value={profileState.coachCohort}
                onChange={(e) => setProfileState((s) => ({ ...s, coachCohort: e.target.value }))}
                placeholder="Turma 01"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-600">
              % aulas
              <input
                type="number"
                min={0}
                max={100}
                value={profileState.classAttendancePercent}
                onChange={(e) => setProfileState((s) => ({ ...s, classAttendancePercent: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Data de renovação
              <input
                type="date"
                value={profileState.renewalDate}
                onChange={(e) => setProfileState((s) => ({ ...s, renewalDate: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-gray-600">
              Estado renovação
              <select
                value={profileState.renewalState}
                onChange={(e) => setProfileState((s) => ({ ...s, renewalState: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="NOT_DUE">Não chegou</option>
                <option value="DUE_SOON">Perto de renovar</option>
                <option value="NEEDS_RENEWAL">Precisa renovar</option>
                <option value="AUDIO_SENT">Áudio enviado</option>
                <option value="RENEWED">Renovou</option>
                <option value="ENDED">Encerrado</option>
              </select>
            </label>
            <label className="text-xs font-medium text-gray-600">
              Último contato
              <input
                type="date"
                value={profileState.lastOperationalContactAt}
                onChange={(e) => setProfileState((s) => ({ ...s, lastOperationalContactAt: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              ["boardUrl", "Board URL"],
              ["notionUrl", "Notion URL"],
              ["linkedinUrl", "LinkedIn"],
              ["interviewRecordingFolderUrl", "Pasta gravações"],
            ].map(([key, label]) => (
              <label key={key} className="text-xs font-medium text-gray-600">
                {label}
                <input
                  value={profileState[key as keyof typeof profileState] as string}
                  onChange={(e) => setProfileState((s) => ({ ...s, [key]: e.target.value }))}
                  placeholder="https://"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>

          <label className="mt-4 block text-xs font-medium text-gray-600">
            Observações internas
            <textarea
              value={profileState.notes}
              onChange={(e) => setProfileState((s) => ({ ...s, notes: e.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>
        </section>

        <section className="bg-white rounded-2xl border border-gray-200 p-6">
          <h2 className="text-base font-display font-semibold text-brand-verde flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Sinais rápidos
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400">Renovação</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                {profileState.renewalDate
                  ? format(new Date(profileState.renewalDate), "dd/MM/yyyy")
                  : "Sem data"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400">CV final</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">
                {latestFinalCv ? `v${latestFinalCv.version}` : "Pendente"}
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400">Atividades</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{activities.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 p-4">
              <p className="text-xs text-gray-400">Documentos</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{documents.length}</p>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {["boardUrl", "notionUrl", "linkedinUrl", "interviewRecordingFolderUrl"].map((key) => {
              const value = profileState[key as keyof typeof profileState] as string;
              if (!value) return null;
              return (
                <a
                  key={key}
                  href={value}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-brand-verde/40 hover:text-brand-verde"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {key === "boardUrl"
                    ? "Abrir board"
                    : key === "notionUrl"
                      ? "Abrir Notion"
                      : key === "linkedinUrl"
                        ? "Abrir LinkedIn"
                        : "Abrir gravações"}
                </a>
              );
            })}
          </div>
        </section>
      </div>

      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-brand-verde" />
          <h2 className="text-base font-display font-semibold text-brand-verde">
            CV, material e documentos
          </h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              uploadDocument.mutate();
            }}
            className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-3"
          >
            <div className="grid grid-cols-2 gap-3">
              <select
                value={documentState.kind}
                onChange={(e) => setDocumentState((s) => ({ ...s, kind: e.target.value }))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {DOCUMENT_KINDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                value={documentState.status}
                onChange={(e) => setDocumentState((s) => ({ ...s, status: e.target.value }))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {DOCUMENT_STATUSES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={documentState.title}
              onChange={(e) => setDocumentState((s) => ({ ...s, title: e.target.value }))}
              placeholder="Título interno"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <input
              type="file"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
              onChange={(e) => setDocumentState((s) => ({ ...s, file: e.target.files?.[0] ?? null }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            />
            <textarea
              value={documentState.extractedText}
              onChange={(e) => setDocumentState((s) => ({ ...s, extractedText: e.target.value }))}
              rows={3}
              placeholder="Texto extraído ou resumo do CV/material"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={uploadDocument.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Upload className="h-3.5 w-3.5" />
              {uploadDocument.isPending ? "Subindo..." : "Salvar documento"}
            </button>
          </form>

          <div className="divide-y divide-gray-100">
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400">Nenhum documento operacional salvo ainda.</p>
            ) : (
              documents.map((document) => (
                <div key={document.id} className="py-3 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {document.title || document.filename}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatKind(document.kind)} · v{document.version} · {document.status} ·{" "}
                      {format(new Date(document.uploadedAt), "dd/MM/yyyy")}
                    </p>
                    {document.uploadedBy?.name && (
                      <p className="text-xs text-gray-400 mt-1">Por {document.uploadedBy.name}</p>
                    )}
                  </div>
                  <a
                    href={`/api/storage/local?key=${encodeURIComponent(document.storageKey)}&download=1`}
                    className="text-xs font-semibold text-brand-verde hover:underline"
                  >
                    Baixar
                  </a>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <BriefcaseBusiness className="h-4 w-4 text-brand-verde" />
          <h2 className="text-base font-display font-semibold text-brand-verde">
            Aplicações, entrevistas e ofertas
          </h2>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addActivity.mutate();
          }}
          className="rounded-xl bg-gray-50 border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
        >
          <select
            value={activityState.type}
            onChange={(e) => setActivityState((s) => ({ ...s, type: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {ACTIVITY_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={activityState.activityDate}
            onChange={(e) => setActivityState((s) => ({ ...s, activityDate: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={activityState.company}
            onChange={(e) => setActivityState((s) => ({ ...s, company: e.target.value }))}
            placeholder="Empresa"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={activityState.roleTitle}
            onChange={(e) => setActivityState((s) => ({ ...s, roleTitle: e.target.value }))}
            placeholder="Cargo"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={activityState.area}
            onChange={(e) => setActivityState((s) => ({ ...s, area: e.target.value }))}
            placeholder="Área"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={activityState.industry}
            onChange={(e) => setActivityState((s) => ({ ...s, industry: e.target.value }))}
            placeholder="Indústria"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={activityState.outcome}
            onChange={(e) => setActivityState((s) => ({ ...s, outcome: e.target.value }))}
            placeholder="Resultado"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={addActivity.isPending}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {addActivity.isPending ? "Salvando..." : "Registrar"}
          </button>
        </form>

        <div className="mt-4 divide-y divide-gray-100">
          {activities.length === 0 ? (
            <p className="text-sm text-gray-400">Nenhuma atividade registrada ainda.</p>
          ) : (
            activities.map((activity) => (
              <div key={activity.id} className="py-3">
                <p className="text-sm font-semibold text-gray-900">
                  {formatActivity(activity.type)}
                  {activity.company ? ` · ${activity.company}` : ""}
                  {activity.roleTitle ? ` · ${activity.roleTitle}` : ""}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {format(new Date(activity.activityDate), "dd/MM/yyyy")}
                  {activity.outcome ? ` · ${activity.outcome}` : ""}
                  {activity.createdBy?.name ? ` · ${activity.createdBy.name}` : ""}
                </p>
                {activity.notes && <p className="text-xs text-gray-500 mt-1">{activity.notes}</p>}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
