"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FormsSection } from "./FormsSection";
import { OperationalHubSection } from "./OperationalHubSection";
import { OpsStudentDigisacPanel } from "./OpsStudentDigisacPanel";
import { OpsStudentAiPanel } from "./OpsStudentAiPanel";
import { SessionSection } from "./SessionSection";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Clock,
  Eye,
  FileText,
  ListChecks,
  Send,
  User,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";

type ProfileData = {
  enrollment: {
    id: string;
    programType: string;
    status: string;
    startDate: string;
    customer: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      preferredLanguage: string | null;
      dateOfBirth: string | null;
      address: string | null;
      city: string | null;
      state: string | null;
      zipCode: string | null;
      country: string | null;
      qbBalance: string | null;
      qbTotalInvoiced: string | null;
      qbTotalPaid: string | null;
      lastQbBalanceSync: string | null;
      contracts: Array<{
        id: string;
        status: string;
        docusign_env_id: string | null;
        sentAt: string | null;
        signedAt: string | null;
        expiresAt: string | null;
        signedS3Key: string | null;
        signedS3Url: string | null;
      }>;
      invoices: Array<{
        id: string;
        invoiceNumber: string | null;
        amount: string;
        amountPaid: string | null;
        dueDate: string;
        paidAt: string | null;
        status: string;
        paymentMethod: string | null;
        quickbooks_invoice_link: string | null;
      }>;
      deals: Array<{
        id: string;
        title: string;
        value: string;
        currency: string;
        status: string;
        createdAt: string;
        owner: { name: string | null } | null;
      }>;
    };
    currentPhase: { id?: string; key?: string; label: string; sortOrder: number; slaDays?: number } | null;
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
      status?: string;
      sessionDate: string;
      rescheduleCount?: number;
      notes: string | null;
      conductor: { name: string };
      performedByUser?: { name: string | null } | null;
      performedByStaff?: { name: string; status: string } | null;
    }>;
    opsProfile: {
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
    opsDocuments: Array<{
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
    }>;
    opsActivities: Array<{
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
    }>;
    formAssignments: Array<{
      id: string;
      templateId: string;
      status: string;
      assignedAt: string;
      submission: { id: string; submittedAt: string; answers: Record<string, unknown> | null } | null;
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
  mockInterviews: Array<{
    id: string;
    status: string;
    targetRole: string | null;
    interviewFocus: string | null;
    overallScore: number | null;
    communicationScore: number | null;
    experienceScore: number | null;
    problemSolvingScore: number | null;
    roleFitScore: number | null;
    executivePresenceScore: number | null;
    hiringSignal: string | null;
    summary: string | null;
    strengths: string[];
    risks: string[];
    focusAreas: string[];
    durationSeconds: number | null;
    completedAt: string | null;
    createdAt: string;
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

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return format(new Date(value), "dd/MM/yyyy");
}

function formatMoney(value: string | null | undefined) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

function getStatusBadge(status: string) {
  if (["PAID", "SIGNED", "COMPLETED", "WON"].includes(status)) return "bg-emerald-50 text-emerald-700";
  if (["OVERDUE", "FAILED", "DECLINED", "VOIDED", "LOST"].includes(status)) return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function InfoLine({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-gray-50 py-2 last:border-0">
      <span className="min-w-0 text-xs text-gray-400">{label}</span>
      <span className="min-w-0 max-w-[62%] break-words text-right text-xs font-semibold text-gray-700">{value || "—"}</span>
    </div>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "C";
}

function MetricTile({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  detail?: string;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}) {
  const tones = {
    neutral: "border-gray-100 bg-white text-gray-900",
    success: "border-emerald-100 bg-emerald-50 text-emerald-700",
    warning: "border-amber-100 bg-amber-50 text-amber-700",
    danger: "border-red-100 bg-red-50 text-red-700",
    info: "border-blue-100 bg-blue-50 text-blue-700",
  } as const;

  return (
    <div className={`min-w-0 rounded-xl border p-3 ${tones[tone]}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 break-words text-lg font-display font-bold">{value}</p>
      {detail && <p className="mt-1 break-words text-[11px] font-medium opacity-75">{detail}</p>}
    </div>
  );
}

function ProfileStat({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</dt>
      <dd
        className={`mt-1 break-words text-[18px] font-semibold leading-tight tabular-nums ${
          accent ? "text-brand-tangerina" : "text-gray-900"
        }`}
      >
        {value}
      </dd>
      {detail && (
        <p className="mt-0.5 break-words text-[12px] font-medium text-gray-500 tabular-nums">{detail}</p>
      )}
    </div>
  );
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86_400_000);
}

export function StudentProfileClient({
  enrollmentId,
  currentUserId,
}: {
  enrollmentId: string;
  currentUserId: string;
}) {
  const { data, isLoading, error } = useProfileData(enrollmentId);
  const [accessAction, setAccessAction] = useState<{
    loading: boolean;
    message: string | null;
    error: string | null;
  }>({ loading: false, message: null, error: null });

  if (isLoading) return <div className="p-8 text-sm text-gray-400">Carregando perfil...</div>;
  if (error || !data?.enrollment) {
    return <div className="p-8 text-sm text-red-500">Erro ao carregar perfil do cliente.</div>;
  }

  const { enrollment, placementTest, totalSessions } = data;
  const signedContract = enrollment.customer.contracts.find((contract) => contract.signedAt);
  const latestInvoice = enrollment.customer.invoices[0];
  const latestDeal = enrollment.customer.deals[0];
  const latestMock = data.mockInterviews[0];
  const latestSession = enrollment.sessions[0];
  const pendingHubTasks = enrollment.formAssignments.filter((assignment) => assignment.status !== "COMPLETED").length;
  const completedHubTasks = enrollment.formAssignments.filter((assignment) => assignment.status === "COMPLETED").length;
  const finalDocuments = enrollment.opsDocuments.filter((document) => document.status === "FINAL");
  const studentVisibleDocuments = enrollment.opsDocuments.filter((document) => document.visibility === "STUDENT_VISIBLE");
  const applications = enrollment.opsActivities.filter((activity) => activity.type === "APPLICATION");
  const interviews = enrollment.opsActivities.filter((activity) => activity.type === "INTERVIEW");
  const applicationsMissingLink = applications.filter((activity) => !activity.jobUrl).length;
  const interviewsMissingStatus = interviews.filter((activity) => !activity.status).length;
  const noShowSessions = enrollment.sessions.filter((session) => session.status === "NO_SHOW").length;
  const rescheduledSessions = enrollment.sessions.filter((session) => session.status === "REMARCADO").length;
  const renewalInDays = daysUntil(enrollment.opsProfile?.renewalDate);
  const openBalance = Number(enrollment.customer.qbBalance ?? 0);
  const phaseAgeDays = enrollment.transitions[0]?.createdAt
    ? Math.max(0, Math.floor((Date.now() - new Date(enrollment.transitions[0].createdAt).getTime()) / 86_400_000))
    : Math.max(0, Math.floor((Date.now() - new Date(enrollment.startDate).getTime()) / 86_400_000));
  const attentionItems = [
    pendingHubTasks > 0 ? `${pendingHubTasks} formulário${pendingHubTasks !== 1 ? "s" : ""} pendente${pendingHubTasks !== 1 ? "s" : ""}` : null,
    applicationsMissingLink > 0 ? `${applicationsMissingLink} aplicação${applicationsMissingLink !== 1 ? "ões" : ""} sem link` : null,
    interviewsMissingStatus > 0 ? `${interviewsMissingStatus} entrevista${interviewsMissingStatus !== 1 ? "s" : ""} sem status` : null,
    renewalInDays !== null && renewalInDays <= 30 ? `Renovação em ${renewalInDays} dia${renewalInDays !== 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  async function resendHubAccess() {
    setAccessAction({ loading: true, message: null, error: null });
    try {
      const response = await fetch(`/api/ops/enrollments/${enrollmentId}/resend-access`, {
        method: "POST",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Falha ao reenviar acesso.");
      }
      setAccessAction({
        loading: false,
        message: `Acesso reenviado para ${payload.email ?? enrollment.customer.email}.`,
        error: null,
      });
    } catch (err) {
      setAccessAction({
        loading: false,
        message: null,
        error: err instanceof Error ? err.message : "Falha ao reenviar acesso.",
      });
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-5 bg-gray-50/40 px-4 py-5 sm:px-6 md:space-y-6 md:p-8">
      {/* Back nav */}
      <Link
        href="/ops/pipeline"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-verde transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar à lista de clientes
      </Link>

      <div className="overflow-hidden rounded-xl border border-gray-200/60 bg-white">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 px-5 py-6 sm:px-6 md:px-7 md:py-7">
            {/* Identity */}
            <div className="flex min-w-0 items-start gap-4">
              <div
                aria-hidden
                className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-[14px] font-bold tracking-wide text-gray-700"
              >
                {getInitials(enrollment.customer.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
                  {enrollment.programType}
                  {enrollment.opsProfile?.seniority && (
                    <span className="text-gray-300"> · {enrollment.opsProfile.seniority.replace("_", " ").toLowerCase()}</span>
                  )}
                </p>
                <h1 className="mt-1 break-words text-[26px] font-semibold leading-tight tracking-tight text-gray-900 sm:text-[30px]">
                  {enrollment.customer.name}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-gray-500">
                  <span className="break-all">{enrollment.customer.email}</span>
                  {enrollment.customer.phone && <span>· {enrollment.customer.phone}</span>}
                  {enrollment.customer.state && <span>· {enrollment.customer.state}</span>}
                </div>
                <p className="mt-2 text-[13px] text-gray-500">
                  Responsável: <span className="font-medium text-gray-700">{enrollment.assignedTo.name}</span>
                  {attentionItems.length > 0 ? (
                    <>
                      {" · "}
                      <span className="font-medium text-brand-tangerina tabular-nums">
                        {attentionItems.length} ponto{attentionItems.length !== 1 ? "s" : ""} de atenção
                      </span>
                    </>
                  ) : (
                    <span className="text-emerald-700"> · em dia</span>
                  )}
                </p>
              </div>
            </div>

            {/* Metrics row — inline, no card grid */}
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 sm:gap-x-8">
              <ProfileStat
                label="Fase"
                value={enrollment.currentPhase?.label ?? "Sem fase"}
                detail={`${phaseAgeDays}d na fase`}
                accent={Boolean(enrollment.currentPhase?.slaDays && phaseAgeDays > enrollment.currentPhase.slaDays)}
              />
              <ProfileStat
                label="Renovação"
                value={formatDate(enrollment.opsProfile?.renewalDate)}
                detail={renewalInDays === null ? "sem data" : `${renewalInDays}d`}
                accent={renewalInDays !== null && renewalInDays <= 30}
              />
              <ProfileStat
                label="Sessões"
                value={String(totalSessions)}
                detail={latestSession ? `última ${formatDate(latestSession.sessionDate)}` : "sem registro"}
              />
              <ProfileStat
                label="Aberto QB"
                value={formatMoney(enrollment.customer.qbBalance)}
                detail={`${formatMoney(enrollment.customer.qbTotalPaid)} pago`}
                accent={openBalance > 0}
              />
            </dl>

            {attentionItems.length > 0 && (
              <div className="mt-5 flex flex-wrap items-center gap-2 text-[12px]">
                <span className="font-semibold uppercase tracking-wide text-gray-400">Atenção:</span>
                {attentionItems.map((item, idx) => (
                  <span key={item} className="text-gray-700">
                    {idx > 0 && <span className="text-gray-300">·</span>} {item}
                  </span>
                ))}
              </div>
            )}
          </div>

          <aside className="border-t border-gray-100 px-5 py-6 sm:px-6 md:py-7 lg:border-l lg:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              Ações rápidas
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              <Link
                href={`/ops/students/${enrollmentId}/portal-preview`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand-verde px-3 text-[12.5px] font-medium text-white transition hover:bg-brand-verde/90"
              >
                <Eye className="h-3.5 w-3.5" strokeWidth={1.75} />
                Ver portal do cliente
              </Link>
              <button
                type="button"
                onClick={resendHubAccess}
                disabled={accessAction.loading}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-[12.5px] font-medium text-gray-700 transition hover:border-brand-verde hover:text-brand-verde disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={1.75} />
                {accessAction.loading ? "Enviando..." : "Reenviar acesso"}
              </button>
            </div>

            {(accessAction.message || accessAction.error) && (
              <p
                className={`mt-3 text-[12px] font-medium ${
                  accessAction.error ? "text-red-600" : "text-emerald-700"
                }`}
              >
                {accessAction.error ?? accessAction.message}
              </p>
            )}

            <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">
              Resumo
            </p>
            <div className="mt-3">
              <InfoLine label="Início" value={format(new Date(enrollment.startDate), "dd/MM/yyyy")} />
              <InfoLine label="Contrato" value={formatDate(signedContract?.signedAt)} />
              <InfoLine label="Tasks Hub" value={`${pendingHubTasks} pend · ${completedHubTasks} feitas`} />
              <InfoLine label="Materiais finais" value={finalDocuments.length} />
              <InfoLine label="Aplicações" value={applications.length} />
              <InfoLine label="Inglês" value={placementTest ? `${placementTest.displayLevel} (${Math.round(placementTest.percentage)}%)` : "—"} />
            </div>
          </aside>
        </div>

        {data.npsResults.length > 0 && (
          <div className="border-t border-gray-100 px-4 py-3 sm:px-5">
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-display font-semibold text-brand-verde">
            <Clock className="h-4 w-4" />
            Jornada
          </h2>
          <InfoLine label="Fase" value={enrollment.currentPhase?.label} />
          <InfoLine label="Renovação" value={formatDate(enrollment.opsProfile?.renewalDate)} />
          <InfoLine label="No show" value={noShowSessions} />
          <InfoLine label="Remarcadas" value={rescheduledSessions} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-display font-semibold text-brand-verde">
            <User className="h-4 w-4" />
            Dados do cliente
          </h2>
          <InfoLine label="Telefone" value={enrollment.customer.phone} />
          <InfoLine label="Idioma" value={enrollment.customer.preferredLanguage} />
          <InfoLine label="Nascimento" value={formatDate(enrollment.customer.dateOfBirth)} />
          <InfoLine label="Estado" value={enrollment.customer.state} />
          <InfoLine label="Endereço" value={[enrollment.customer.address, enrollment.customer.city, enrollment.customer.country].filter(Boolean).join(", ")} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-display font-semibold text-brand-verde">
            <WalletCards className="h-4 w-4" />
            Contrato & financeiro
          </h2>
          <div className="mb-3 flex flex-wrap gap-2">
            {signedContract ? (
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${getStatusBadge(signedContract.status)}`}>
                {signedContract.status}
              </span>
            ) : (
              <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-bold text-gray-500">
                Sem contrato assinado
              </span>
            )}
            {latestInvoice && (
              <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${getStatusBadge(latestInvoice.status)}`}>
                {latestInvoice.status}
              </span>
            )}
          </div>
          <InfoLine label="Assinado em" value={formatDate(signedContract?.signedAt)} />
          <InfoLine label="Invoice recente" value={latestInvoice?.invoiceNumber} />
          <InfoLine label="Valor invoice" value={latestInvoice ? formatMoney(latestInvoice.amount) : "—"} />
          <InfoLine label="Pago" value={formatMoney(enrollment.customer.qbTotalPaid)} />
          <InfoLine label="Aberto QB" value={formatMoney(enrollment.customer.qbBalance)} />
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-display font-semibold text-brand-verde">
            <BriefcaseBusiness className="h-4 w-4" />
            Testes & mock
          </h2>
          <InfoLine label="Deal" value={latestDeal?.title} />
          <InfoLine label="Valor do deal" value={latestDeal ? formatMoney(latestDeal.value) : "—"} />
          <InfoLine label="Inglês" value={placementTest ? `${placementTest.displayLevel} (${Math.round(placementTest.percentage)}%)` : "—"} />
          <InfoLine label="Mock interview" value={latestMock?.targetRole || latestMock?.interviewFocus || "—"} />
          <InfoLine label="Score mock" value={latestMock?.overallScore ? `${latestMock.overallScore}/100` : "—"} />
          <InfoLine label="Sinal de contratação" value={latestMock?.hiringSignal} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-display font-semibold text-brand-verde">
            <Eye className="h-4 w-4" />
            Visível ao cliente
          </h2>
          <InfoLine label="Documentos públicos" value={studentVisibleDocuments.length} />
          <InfoLine label="Canva" value={enrollment.opsProfile?.canvaUrl ? "Configurado" : "—"} />
          <InfoLine label="Material" value={enrollment.opsProfile?.studentMaterialUrl ? "Configurado" : "—"} />
          <InfoLine label="Forms pendentes" value={pendingHubTasks} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-display font-semibold text-brand-verde">
          <ListChecks className="h-4 w-4" />
          Publicação no portal do cliente
        </h2>
        <div className="grid gap-3 text-xs text-gray-600 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">Formulários</p>
            <p className="mt-1">{pendingHubTasks} tarefas pendentes para o cliente.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">Documentos</p>
            <p className="mt-1">{enrollment.opsDocuments.length} arquivos operacionais no caso.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">Sessões</p>
            <p className="mt-1">{totalSessions} registros para orientar próximas etapas.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">AI interviews</p>
            <p className="mt-1">{data.mockInterviews.length} simulação{data.mockInterviews.length !== 1 ? "ões" : ""} registrada{data.mockInterviews.length !== 1 ? "s" : ""}.</p>
          </div>
        </div>
      </div>

      <OperationalHubSection
        enrollmentId={enrollmentId}
        customerId={enrollment.customer.id}
        currentUserId={currentUserId}
        profile={enrollment.opsProfile}
        documents={enrollment.opsDocuments}
        activities={enrollment.opsActivities}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <OpsStudentDigisacPanel
          enrollmentId={enrollmentId}
          customerName={enrollment.customer.name}
          customerPhone={enrollment.customer.phone}
        />

        <OpsStudentAiPanel
          enrollmentId={enrollmentId}
          customerName={enrollment.customer.name}
          currentPhase={enrollment.currentPhase?.label}
          ownerName={enrollment.assignedTo.name}
        />
      </div>

      {/* Phase timeline */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
        <h2 className="text-base font-display font-semibold text-brand-verde mb-4 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de Fases
        </h2>
        {enrollment.transitions.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhuma transição registrada ainda.</p>
        ) : (
          <ol className="relative space-y-4 border-l border-gray-200 pl-5 sm:pl-6">
            {enrollment.transitions.map((t) => (
              <li key={t.id} className="relative">
                <span className="absolute -left-[1.4rem] top-1 h-3 w-3 rounded-full bg-brand-verde/20 border-2 border-brand-verde" />
                <p className="break-words text-sm font-medium text-gray-800">
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

      {data.mockInterviews.length > 0 && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-display font-semibold text-brand-verde">
            <FileText className="h-4 w-4" />
            Mock interviews AI
          </h2>
          <div className="space-y-3">
            {data.mockInterviews.map((mock) => (
              <div key={mock.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{mock.targetRole || "Mock interview"}</p>
                    <p className="text-xs text-gray-400">
                      {formatDate(mock.completedAt ?? mock.createdAt)} · {mock.interviewFocus || "Treinamento geral"}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${getStatusBadge(mock.status)}`}>
                    {mock.overallScore ? `${mock.overallScore}/100` : mock.status}
                  </span>
                </div>
                {mock.summary && <p className="mt-3 text-sm leading-relaxed text-gray-600">{mock.summary}</p>}
                {mock.focusAreas.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500">
                    Foco: {mock.focusAreas.slice(0, 3).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
