"use client";

import { useQuery } from "@tanstack/react-query";
import { FormsSection } from "./FormsSection";
import { OperationalHubSection } from "./OperationalHubSection";
import { SessionSection } from "./SessionSection";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  ListChecks,
  ShieldCheck,
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

  if (isLoading) return <div className="p-8 text-sm text-gray-400">Carregando perfil...</div>;
  if (error || !data?.enrollment) {
    return <div className="p-8 text-sm text-red-500">Erro ao carregar perfil do aluno.</div>;
  }

  const { enrollment, placementTest, totalSessions } = data;
  const signedContract = enrollment.customer.contracts.find((contract) => contract.signedAt);
  const latestInvoice = enrollment.customer.invoices[0];
  const latestDeal = enrollment.customer.deals[0];
  const latestMock = data.mockInterviews[0];
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
  const attentionItems = [
    pendingHubTasks > 0 ? `${pendingHubTasks} formulário${pendingHubTasks !== 1 ? "s" : ""} pendente${pendingHubTasks !== 1 ? "s" : ""}` : null,
    applicationsMissingLink > 0 ? `${applicationsMissingLink} aplicação${applicationsMissingLink !== 1 ? "ões" : ""} sem link` : null,
    interviewsMissingStatus > 0 ? `${interviewsMissingStatus} entrevista${interviewsMissingStatus !== 1 ? "s" : ""} sem status` : null,
    renewalInDays !== null && renewalInDays <= 30 ? `Renovação em ${renewalInDays} dia${renewalInDays !== 1 ? "s" : ""}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-7xl space-y-5 px-4 py-5 sm:px-6 md:space-y-6 md:p-8">
      {/* Back nav */}
      <Link
        href="/ops/pipeline"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-verde transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar a lista de alunos
      </Link>

      {/* Header card */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5 md:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-verde/10 sm:h-12 sm:w-12">
              <User className="h-6 w-6 text-brand-verde" />
            </div>
            <div className="min-w-0">
              <h1 className="break-words text-lg font-display font-bold text-brand-verde sm:text-xl">
                {enrollment.customer.name}
              </h1>
              <p className="break-all text-sm text-gray-500">{enrollment.customer.email}</p>
              {enrollment.customer.phone && (
                <p className="text-sm text-gray-400">{enrollment.customer.phone}</p>
              )}
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  {enrollment.programType}
                </span>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600">
                  {enrollment.assignedTo.name}
                </span>
                {enrollment.opsProfile?.seniority && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                    {enrollment.opsProfile.seniority.replace("_", " ")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center lg:justify-end">
            <Link
              href={`/ops/students/${enrollmentId}/portal-preview`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand-verde/20 bg-brand-verde px-3 py-2 text-center text-xs font-semibold text-white hover:opacity-90"
            >
              <Eye className="h-3.5 w-3.5" />
              Ver portal do aluno
            </Link>
            <span className={`inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-center text-xs font-bold ${
              attentionItems.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
            }`}>
              {attentionItems.length ? <AlertTriangle className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {attentionItems.length ? `${attentionItems.length} alerta${attentionItems.length !== 1 ? "s" : ""}` : "Em dia"}
            </span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 min-[420px]:grid-cols-2 md:mt-6 md:grid-cols-4 xl:grid-cols-7">
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Fase Atual</p>
            <p className="text-sm font-medium text-gray-800 mt-1">
              {enrollment.currentPhase?.label ?? "—"}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Início</p>
            <p className="text-sm font-medium text-gray-800 mt-1">
              {format(new Date(enrollment.startDate), "dd/MM/yyyy")}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Contrato assinado</p>
            <p className="text-sm font-medium text-gray-800 mt-1">{formatDate(signedContract?.signedAt)}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Tasks no Hub</p>
            <p className="text-sm font-medium text-gray-800 mt-1">
              {pendingHubTasks} pendente{pendingHubTasks !== 1 ? "s" : ""} · {completedHubTasks} feita{completedHubTasks !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Materiais finais</p>
            <p className="text-sm font-medium text-gray-800 mt-1">{finalDocuments.length}</p>
          </div>
          <div className="rounded-xl bg-gray-50 p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Aplicações</p>
            <p className="text-sm font-medium text-gray-800 mt-1">{applications.length}</p>
          </div>
          {placementTest && (
            <div className="rounded-xl bg-gray-50 p-3">
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

        {attentionItems.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3">
            {attentionItems.map((item) => (
              <span key={item} className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-700">
                {item}
              </span>
            ))}
          </div>
        )}

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
            Visível ao aluno
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
          Como isso alimenta o Hub do cliente
        </h2>
        <div className="grid gap-3 text-xs text-gray-600 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg bg-gray-50 p-3">
            <p className="font-semibold text-gray-900">Formulários</p>
            <p className="mt-1">{pendingHubTasks} tarefas liberadas pelo operacional.</p>
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
        profile={enrollment.opsProfile}
        documents={enrollment.opsDocuments}
        activities={enrollment.opsActivities}
      />

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
