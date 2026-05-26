"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  seniority: string | null;
  coachCohort: string | null;
  classAttendancePercent: number | null;
  boardUrl: string | null;
  notionUrl: string | null;
  linkedinUrl: string | null;
  canvaUrl: string | null;
  studentMaterialUrl: string | null;
  interviewRecordingFolderUrl: string | null;
  contractPdfKey: string | null;
  renewalDate: string | null;
  renewalState: string;
  renewalAdjustmentReason?: string | null;
  pauseExtensionDays?: number | null;
  lastOperationalContactAt: string | null;
  notes: string | null;
} | null;

type OpsDocument = {
  id: string;
  kind: string;
  resourceType?: string;
  visibility?: string;
  status: string;
  title: string | null;
  filename: string;
  storageKey: string;
  externalUrl?: string | null;
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
  jobUrl?: string | null;
  salary?: string | null;
  status?: string | null;
  visibility?: string | null;
  outcome: string | null;
  notes: string | null;
  createdBy: { name: string } | null;
  performedByUser?: { name: string | null } | null;
  performedByStaff?: { name: string; status: string } | null;
};

type OpsUserOption = {
  id: string;
  name: string | null;
};

type OpsStaffOption = {
  id: string;
  name: string;
  status: string;
  areas: string[];
};

const DOCUMENT_KINDS = [
  ["CV_ORIGINAL", "CV original"],
  ["CV_FINAL", "CV final"],
  ["COVER_LETTER_ORIGINAL", "Cover letter original"],
  ["COVER_LETTER_FINAL", "Cover letter final"],
  ["CANVA_LINK", "Link Canva"],
  ["STUDENT_MATERIAL", "Material do cliente"],
  ["SUPPORT_MATERIAL", "Material interno"],
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

const VISIBILITIES = [
  ["INTERNAL", "Interno"],
  ["STUDENT_VISIBLE", "Visível ao cliente"],
] as const;

const ACTIVITY_STATUSES = [
  ["EM_PROCESSO", "Em processo"],
  ["PASSOU", "Passou"],
  ["NAO_PASSOU", "Não passou"],
  ["NO_SHOW", "No show"],
  ["REMARCADO", "Remarcado"],
  ["CANCELADO", "Cancelado"],
  ["OFERTA", "Oferta"],
  ["RECOLOCADO", "Recolocado"],
  ["PERDIDO", "Perdido"],
] as const;

const SENIORITY_LEVELS = [
  ["ENTRY_LEVEL", "Entry level"],
  ["MID_LEVEL", "Mid level"],
  ["SENIOR", "Senior"],
  ["DIRECTOR", "Director"],
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

function formatFormerStaffLabel(staff: { name: string; status?: string | null }) {
  return staff.status === "FORMER" ? `${staff.name} (ex-funcionário)` : staff.name;
}

function getActivityActorName(activity: OpsActivity) {
  if (activity.performedByStaff) return formatFormerStaffLabel(activity.performedByStaff);
  return activity.performedByUser?.name ?? activity.createdBy?.name ?? null;
}

function useOperationalActorOptions() {
  const users = useQuery<{ users: OpsUserOption[] }>({
    queryKey: ["ops-users"],
    queryFn: () => fetch("/api/ops/users").then((res) => res.json()),
    staleTime: 5 * 60 * 1000,
  });
  const staffMembers = useQuery<{ staffMembers: OpsStaffOption[] }>({
    queryKey: ["ops-staff-members", "former"],
    queryFn: () => fetch("/api/ops/staff-members?status=FORMER").then((res) => res.json()),
    staleTime: 5 * 60 * 1000,
  });

  return {
    users: users.data?.users ?? [],
    staffMembers: staffMembers.data?.staffMembers ?? [],
  };
}

export function OperationalHubSection({
  enrollmentId,
  currentUserId,
  profile,
  documents,
  activities,
}: {
  enrollmentId: string;
  customerId: string;
  currentUserId: string;
  profile: OpsProfile;
  documents: OpsDocument[];
  activities: OpsActivity[];
}) {
  const qc = useQueryClient();
  const actorOptions = useOperationalActorOptions();
  const [profileState, setProfileState] = useState({
    optStatus: profile?.optStatus ?? "",
    seniority: profile?.seniority ?? "",
    coachCohort: profile?.coachCohort ?? "",
    classAttendancePercent: profile?.classAttendancePercent?.toString() ?? "",
    renewalDate: dateInput(profile?.renewalDate),
    renewalState: profile?.renewalState ?? "NOT_DUE",
    lastOperationalContactAt: dateInput(profile?.lastOperationalContactAt),
    boardUrl: profile?.boardUrl ?? "",
    notionUrl: profile?.notionUrl ?? "",
    linkedinUrl: profile?.linkedinUrl ?? "",
    canvaUrl: profile?.canvaUrl ?? "",
    studentMaterialUrl: profile?.studentMaterialUrl ?? "",
    interviewRecordingFolderUrl: profile?.interviewRecordingFolderUrl ?? "",
    contractPdfKey: profile?.contractPdfKey ?? "",
    pauseExtensionDays: profile?.pauseExtensionDays?.toString() ?? "0",
    renewalAdjustmentReason: profile?.renewalAdjustmentReason ?? "",
    notes: profile?.notes ?? "",
  });
  const [documentState, setDocumentState] = useState({
    kind: "CV_ORIGINAL",
    resourceType: "FILE",
    visibility: "INTERNAL",
    status: "UPLOADED",
    title: "",
    externalUrl: "",
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
    jobUrl: "",
    salary: "",
    status: "EM_PROCESSO",
    visibility: "INTERNAL",
    outcome: "",
    notes: "",
    actorId: "",
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
      if (documentState.resourceType === "FILE" && !documentState.file) {
        throw new Error("Selecione um arquivo.");
      }
      if (documentState.resourceType === "EXTERNAL_LINK" && !documentState.externalUrl.trim()) {
        throw new Error("Informe o link externo.");
      }
      const formData = new FormData();
      if (documentState.file) formData.set("file", documentState.file);
      formData.set("kind", documentState.kind);
      formData.set("resourceType", documentState.resourceType);
      formData.set("visibility", documentState.visibility);
      formData.set("status", documentState.status);
      formData.set("title", documentState.title);
      formData.set("externalUrl", documentState.externalUrl);
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
        resourceType: "FILE",
        visibility: "INTERNAL",
        status: "UPLOADED",
        title: "",
        externalUrl: "",
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
        jobUrl: "",
        salary: "",
        status: "EM_PROCESSO",
        visibility: "INTERNAL",
        outcome: "",
        notes: "",
        actorId: "",
      });
      toast.success("Atividade registrada.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-6">
        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
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
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 sm:w-auto"
            >
              <Save className="h-3.5 w-3.5" />
              {saveProfile.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
              Senioridade
              <select
                value={profileState.seniority}
                onChange={(e) => setProfileState((s) => ({ ...s, seniority: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="">Não informado</option>
                {SENIORITY_LEVELS.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
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
            <label className="text-xs font-medium text-gray-600">
              Dias extras/pausa
              <input
                type="number"
                min={0}
                value={profileState.pauseExtensionDays}
                onChange={(e) => setProfileState((s) => ({ ...s, pauseExtensionDays: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {[
              ["boardUrl", "Board URL"],
              ["notionUrl", "Notion URL"],
              ["linkedinUrl", "LinkedIn"],
              ["canvaUrl", "Canva"],
              ["studentMaterialUrl", "Material visível ao cliente"],
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
            Motivo de ajuste de renovação
            <input
              value={profileState.renewalAdjustmentReason}
              onChange={(e) => setProfileState((s) => ({ ...s, renewalAdjustmentReason: e.target.value }))}
              placeholder="Ex.: pausa por emergência familiar, viagem, licença..."
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
            />
          </label>

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

        <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <h2 className="text-base font-display font-semibold text-brand-verde flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Sinais rápidos
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
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
                  className="flex min-h-10 items-center gap-2 break-all rounded-lg border border-gray-100 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-brand-verde/40 hover:text-brand-verde"
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

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="h-4 w-4 text-brand-verde" />
          <h2 className="text-base font-display font-semibold text-brand-verde">
            CV, material e documentos
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              uploadDocument.mutate();
            }}
            className="space-y-3 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:p-4"
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={documentState.resourceType}
                onChange={(e) => setDocumentState((s) => ({ ...s, resourceType: e.target.value }))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <option value="FILE">Arquivo</option>
                <option value="EXTERNAL_LINK">Link externo</option>
              </select>
              <select
                value={documentState.visibility}
                onChange={(e) => setDocumentState((s) => ({ ...s, visibility: e.target.value }))}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                {VISIBILITIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
            {documentState.resourceType === "EXTERNAL_LINK" ? (
              <input
                value={documentState.externalUrl}
                onChange={(e) => setDocumentState((s) => ({ ...s, externalUrl: e.target.value }))}
                placeholder="https://canva.com/..."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              />
            ) : (
              <input
                type="file"
                accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                onChange={(e) => setDocumentState((s) => ({ ...s, file: e.target.files?.[0] ?? null }))}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
              />
            )}
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
              className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 sm:w-auto"
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
                <div key={document.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-gray-900">
                      {document.title || document.filename}
                    </p>
                    <p className="mt-0.5 break-words text-xs text-gray-400">
                      {formatKind(document.kind)} · v{document.version} · {document.status} · {document.visibility === "STUDENT_VISIBLE" ? "visível ao cliente" : "interno"} ·{" "}
                      {format(new Date(document.uploadedAt), "dd/MM/yyyy")}
                    </p>
                    {document.uploadedBy?.name && (
                      <p className="text-xs text-gray-400 mt-1">Por {document.uploadedBy.name}</p>
                    )}
                  </div>
                  {document.resourceType === "EXTERNAL_LINK" && document.externalUrl ? (
                    <a href={document.externalUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center text-xs font-semibold text-brand-verde hover:underline">
                      Abrir
                    </a>
                  ) : (
                    <a
                      href={`/api/storage/local?key=${encodeURIComponent(document.storageKey)}&download=1`}
                      className="inline-flex min-h-9 items-center text-xs font-semibold text-brand-verde hover:underline"
                    >
                      Baixar
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
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
          className="grid grid-cols-1 gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 sm:grid-cols-2 sm:p-4 xl:grid-cols-4"
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
          <select
            value={activityState.actorId}
            onChange={(e) => setActivityState((s) => ({ ...s, actorId: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            <option value="">Quem atuou: usuário atual</option>
            {actorOptions.users.map((user) => (
              <option key={user.id} value={`user:${user.id}`}>
                {user.id === currentUserId ? "Eu" : user.name ?? "Sem nome"} (ativo)
              </option>
            ))}
            {actorOptions.staffMembers.map((staff) => (
              <option key={staff.id} value={`staff:${staff.id}`}>
                {formatFormerStaffLabel(staff)}
              </option>
            ))}
          </select>
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
            value={activityState.jobUrl}
            onChange={(e) => setActivityState((s) => ({ ...s, jobUrl: e.target.value }))}
            placeholder="Link da vaga"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <input
            value={activityState.salary}
            onChange={(e) => setActivityState((s) => ({ ...s, salary: e.target.value }))}
            placeholder="Salário"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <select
            value={activityState.status}
            onChange={(e) => setActivityState((s) => ({ ...s, status: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {ACTIVITY_STATUSES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select
            value={activityState.visibility}
            onChange={(e) => setActivityState((s) => ({ ...s, visibility: e.target.value }))}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          >
            {VISIBILITIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input
            value={activityState.outcome}
            onChange={(e) => setActivityState((s) => ({ ...s, outcome: e.target.value }))}
            placeholder="Resultado"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={addActivity.isPending}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-brand-verde px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
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
                <p className="break-words text-sm font-semibold text-gray-900">
                  {formatActivity(activity.type)}
                  {activity.company ? ` · ${activity.company}` : ""}
                  {activity.roleTitle ? ` · ${activity.roleTitle}` : ""}
                </p>
                <p className="mt-0.5 break-words text-xs text-gray-400">
                  {format(new Date(activity.activityDate), "dd/MM/yyyy")}
                  {activity.status ? ` · ${activity.status.replace("_", " ")}` : ""}
                  {activity.outcome ? ` · ${activity.outcome}` : ""}
                  {activity.jobUrl ? " · com link" : ""}
                  {getActivityActorName(activity) ? ` · Atuou: ${getActivityActorName(activity)}` : ""}
                </p>
                {activity.notes && <p className="mt-1 break-words text-xs text-gray-500">{activity.notes}</p>}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
