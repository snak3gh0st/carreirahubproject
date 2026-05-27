import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { ContractStatus, InvoiceStatus, FormAssignmentStatus } from "@prisma/client";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";
import { getPhaseChecklist } from "@/lib/ops/phase-checklists";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

export default async function ProgramaPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId: string = payload.customerId;

  const [contracts, invoices, formAssignments, placementTest, realtimeTest, enrollment, deal, mockInterview] = await Promise.all([
    prisma.contract.findMany({
      where: { customerId },
      select: { status: true, signedAt: true },
    }),
    prisma.invoice.findMany({
      where: { customerId },
      select: { status: true, paidAt: true },
    }),
    prisma.formAssignment.findMany({
      where: { customerId },
      include: { submission: true },
      orderBy: { assignedAt: "desc" },
    }),
    prisma.placementTest.findFirst({
      where: { customerId, totalScore: { not: -1 } },
      orderBy: { createdAt: "desc" },
      select: {
        displayLevel: true,
        cefrLevel: true,
        totalScore: true,
        questionCount: true,
        createdAt: true,
        section1Score: true,
        section2Score: true,
        section3Score: true,
        section4Score: true,
        section5Score: true,
      },
    }),
    prisma.englishRealtimeTest.findFirst({
      where: { customerId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: {
        displayLevel: true,
        cefrLevel: true,
        score: true,
        createdAt: true,
      },
    }),
    prisma.mentorshipEnrollment.findFirst({
      where: { customerId, status: "ACTIVE" },
      select: {
        id: true,
        programType: true,
        currentPhase: { select: { key: true, label: true } },
        opsProfile: {
          select: {
            renewalDate: true,
            renewalState: true,
          },
        },
      },
    }),
    prisma.deal.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { title: true, createdAt: true },
    }),
    prisma.aiMockInterviewSession.findFirst({
      where: { customerId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: {
        targetRole: true,
        overallScore: true,
        hiringSignal: true,
        completedAt: true,
      },
    }),
  ]);

  // Phase-scoped: checklist progress + sessions (depend on enrollment)
  const [phaseChecklistProgress, mentorshipSessions] = enrollment
    ? await Promise.all([
        prisma.phaseChecklistProgress.findMany({
          where: { enrollmentId: enrollment.id, phaseKey: enrollment.currentPhase?.key ?? "" },
          select: { itemKey: true, completedAt: true },
        }),
        prisma.mentorshipSession.findMany({
          where: { enrollmentId: enrollment.id },
          orderBy: { sessionDate: "desc" },
          take: 8,
          select: {
            id: true,
            sessionType: true,
            sessionDate: true,
            status: true,
            conductor: { select: { name: true } },
          },
        }),
      ])
    : [[], []];

  // Onboarding step logic (mirrors status route)
  const contractSigned = contracts.some((c) => c.status === ContractStatus.SIGNED);
  const contractDate = contracts.find((c) => c.status === ContractStatus.SIGNED)?.signedAt;
  const anyPaid = invoices.some((i) => i.status === InvoiceStatus.PAID);
  const firstPaidDate = invoices.find((i) => i.status === InvoiceStatus.PAID)?.paidAt;
  const totalForms = formAssignments.length;
  const completedForms = formAssignments.filter((f) => f.status === FormAssignmentStatus.COMPLETED).length;
  const onboardingFormsApplicable = totalForms > 0;
  const onboardingDone = !onboardingFormsApplicable || completedForms === totalForms;
  const englishLevelSource =
    realtimeTest && (!placementTest || realtimeTest.createdAt > placementTest.createdAt)
      ? "realtime"
      : placementTest
        ? "written"
        : null;
  const englishLevel = englishLevelSource === "realtime" ? realtimeTest : placementTest;
  const testDone = !!englishLevel;
  const phaseLabel = enrollment?.currentPhase?.label ?? "";

  type StepStatus = "completed" | "current" | "pending";

  interface Step {
    id: string;
    label: string;
    detail: string;
    status: StepStatus;
    badge?: React.ReactNode;
  }

  const steps: Step[] = [
    {
      id: "contract",
      label: t(lang, "status.contract"),
      status: contractSigned ? "completed" : "current",
      detail: contractSigned && contractDate
        ? new Date(contractDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
        : lang === "pt-BR" ? "Pendente de assinatura" : "Pending signature",
    },
    {
      id: "payment",
      label: t(lang, "status.payment"),
      status: anyPaid ? "completed" : contractSigned ? "current" : "pending",
      detail: anyPaid && firstPaidDate
        ? new Date(firstPaidDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
        : lang === "pt-BR" ? "Aguardando pagamento" : "Awaiting payment",
    },
    ...(onboardingFormsApplicable
      ? [
          {
            id: "onboarding",
            label: "Onboarding",
            status: (onboardingDone ? "completed" : anyPaid ? "current" : "pending") as StepStatus,
            detail: `${completedForms}/${totalForms} ${lang === "pt-BR" ? "formulários" : "forms"}`,
          },
        ]
      : []),
    {
      id: "test",
      label: t(lang, "programa.testTitle"),
      status: testDone ? "completed" : anyPaid ? "current" : "pending",
      detail: testDone
        ? `${englishLevel!.cefrLevel} — ${englishLevel!.displayLevel}`
        : t(lang, "programa.notTaken"),
      badge: testDone ? (
        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {englishLevel!.cefrLevel}
        </span>
      ) : undefined,
    },
    {
      id: "mentorship",
      label: t(lang, "status.mentorship"),
      status: phaseLabel ? "current" : "pending",
      detail: phaseLabel || (testDone ? t(lang, "programa.awaitingEnrollment") : t(lang, "programa.completeSteps")),
    },
  ];

  // Program info
  const programName = deal?.title ?? "";
  const programSince = deal?.createdAt
    ? new Date(deal.createdAt).toLocaleDateString(dateLocale, { month: "long", year: "numeric" })
    : "";

  // Pending and completed forms
  const pendingAssignments = formAssignments.filter((a) => a.status !== FormAssignmentStatus.COMPLETED);
  const completedAssignments = formAssignments.filter((a) => a.status === FormAssignmentStatus.COMPLETED);

  // Phase checklist (current phase): template merged with progress
  const checklistTemplate = enrollment?.currentPhase?.key
    ? getPhaseChecklist(enrollment.currentPhase.key)
    : [];
  const checklistProgressMap = new Map(
    (phaseChecklistProgress as Array<{ itemKey: string; completedAt: Date | null }>).map((p) => [
      p.itemKey,
      p.completedAt,
    ])
  );
  const checklistItems = checklistTemplate.map((item) => ({
    ...item,
    completedAt: checklistProgressMap.get(item.key) ?? null,
  }));
  const checklistTotal = checklistItems.length;
  const checklistCompleted = checklistItems.filter((i) => i.completedAt).length;

  // Sessions: split into upcoming (future) and recent (past)
  const now = new Date();
  const sessions = mentorshipSessions as Array<{
    id: string;
    sessionType: string;
    sessionDate: Date;
    status: string;
    conductor: { name: string };
  }>;
  const upcomingSessions = sessions
    .filter((s) => new Date(s.sessionDate) >= now && s.status !== "CANCELADO")
    .sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());
  const recentSessions = sessions
    .filter((s) => new Date(s.sessionDate) < now)
    .slice(0, 4);
  const nextSession = upcomingSessions[0] ?? null;

  // Renewal banner: state-driven
  const renewalDate = enrollment?.opsProfile?.renewalDate ?? null;
  const renewalState = enrollment?.opsProfile?.renewalState ?? "NOT_DUE";
  const renewalInDays =
    renewalDate !== null
      ? Math.ceil((new Date(renewalDate).getTime() - now.getTime()) / 86_400_000)
      : null;
  const showRenewalBanner =
    renewalDate !== null && ["DUE_SOON", "DUE_NOW", "OVERDUE"].includes(renewalState);

  // Section scores — build from individual fields
  const sectionScores = placementTest
    ? {
        [lang === "pt-BR" ? "Básico" : "Basic"]: placementTest.section1Score,
        [lang === "pt-BR" ? "Elementar" : "Elementary"]: placementTest.section2Score,
        [lang === "pt-BR" ? "Intermediário" : "Intermediate"]: placementTest.section3Score,
        [lang === "pt-BR" ? "Interm. Avançado" : "Upper-Interm."]: placementTest.section4Score,
        [lang === "pt-BR" ? "Avançado" : "Advanced"]: placementTest.section5Score,
      }
    : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t(lang, "programa.title")}</h1>

      {/* Renewal banner */}
      {showRenewalBanner && renewalDate && (
        <div
          className={`flex items-center gap-4 rounded-2xl border p-4 sm:p-5 ${
            renewalState === "OVERDUE"
              ? "border-red-200 bg-red-50"
              : renewalState === "DUE_NOW"
                ? "border-orange-200 bg-orange-50"
                : "border-amber-200 bg-amber-50"
          }`}
        >
          <div
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
              renewalState === "OVERDUE"
                ? "bg-red-100 text-red-700"
                : renewalState === "DUE_NOW"
                  ? "bg-orange-100 text-orange-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold ${
              renewalState === "OVERDUE" ? "text-red-900" : renewalState === "DUE_NOW" ? "text-orange-900" : "text-amber-900"
            }`}>
              {renewalState === "OVERDUE"
                ? (lang === "pt-BR" ? "Renovação vencida" : "Renewal overdue")
                : renewalState === "DUE_NOW"
                  ? (lang === "pt-BR" ? "Hora de renovar seu programa" : "Time to renew your program")
                  : (lang === "pt-BR" ? "Renovação próxima" : "Renewal coming up")}
            </p>
            <p className={`mt-0.5 text-xs ${
              renewalState === "OVERDUE" ? "text-red-700" : renewalState === "DUE_NOW" ? "text-orange-700" : "text-amber-700"
            }`}>
              {lang === "pt-BR" ? "Data:" : "Date:"}{" "}
              <span className="font-semibold">
                {new Date(renewalDate).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}
              </span>
              {renewalInDays !== null && (
                <span className="ml-1">
                  ({renewalInDays >= 0
                    ? (lang === "pt-BR" ? `em ${renewalInDays} dia${renewalInDays !== 1 ? "s" : ""}` : `in ${renewalInDays} day${renewalInDays !== 1 ? "s" : ""}`)
                    : (lang === "pt-BR" ? `${Math.abs(renewalInDays)}d atrás` : `${Math.abs(renewalInDays)}d ago`)})
                </span>
              )}
              {". "}
              {lang === "pt-BR"
                ? "Seu coach vai falar com você sobre os próximos passos."
                : "Your coach will contact you about next steps."}
            </p>
          </div>
        </div>
      )}

      {/* Program hero */}
      {programName ? (
        <div className="bg-gradient-to-br from-brand-verde to-[#3d5c55] rounded-2xl p-5 sm:p-6 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-white/60 uppercase tracking-widest mb-2">
              {t(lang, "programa.activeProgram")}
            </p>
            <h2 className="text-lg sm:text-xl font-extrabold text-white truncate">{programName}</h2>
            {programSince && (
              <p className="text-sm text-white/60 mt-1">{t(lang, "programa.since")} {programSince}</p>
            )}
          </div>
          {phaseLabel && (
            <div className="shrink-0 text-center">
              <div className="w-16 h-16 rounded-full border-[3px] border-brand-tangerina flex items-center justify-center bg-brand-tangerina/15">
                <span className="text-xs font-bold text-brand-tangerina leading-tight text-center px-1 truncate max-w-[52px]">
                  {phaseLabel}
                </span>
              </div>
              <p className="text-[9px] text-brand-tangerina font-semibold mt-1.5">{t(lang, "programa.currentPhase")}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
          <p className="text-sm text-gray-400">{t(lang, "programa.noProgram")}</p>
        </div>
      )}

      {/* Phase checklist + next session — only when active */}
      {enrollment && (checklistItems.length > 0 || nextSession || recentSessions.length > 0) && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Phase checklist */}
          {checklistItems.length > 0 && (
            <div>
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  {lang === "pt-BR" ? "Etapas desta fase" : "Steps for this phase"}
                </h2>
                <p className="text-[11px] font-semibold text-gray-400 tabular-nums">
                  {checklistCompleted}/{checklistTotal}
                </p>
              </div>
              <ul className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                {checklistItems.map((item, idx) => {
                  const isDone = !!item.completedAt;
                  return (
                    <li
                      key={item.key}
                      className={`flex items-center gap-3 px-4 py-3 ${idx < checklistItems.length - 1 ? "border-b border-gray-50" : ""}`}
                    >
                      <div className="shrink-0">
                        {isDone ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500">
                            <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-gray-200" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm ${isDone ? "text-gray-400 line-through" : "font-medium text-gray-900"}`}>
                          {item.label}
                        </p>
                        {isDone && item.completedAt && (
                          <p className="mt-0.5 text-[11px] text-gray-400">
                            {new Date(item.completedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Sessions */}
          {(nextSession || recentSessions.length > 0) && (
            <div>
              <h2 className="mb-3 text-sm font-bold text-gray-900">
                {lang === "pt-BR" ? "Sessões" : "Sessions"}
              </h2>
              <div className="space-y-3">
                {nextSession ? (
                  <div className="rounded-2xl border-2 border-brand-tangerina/30 bg-orange-50/40 p-4 sm:p-5">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-tangerina">
                      {lang === "pt-BR" ? "Próxima sessão" : "Next session"}
                    </p>
                    <p className="mt-1 text-base font-bold text-gray-900">
                      {new Date(nextSession.sessionDate).toLocaleDateString(dateLocale, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                    <p className="text-sm font-semibold text-brand-tangerina">
                      {new Date(nextSession.sessionDate).toLocaleTimeString(dateLocale, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">
                      {nextSession.sessionType}
                      {nextSession.conductor?.name && (
                        <span className="ml-2 text-gray-400">
                          · {lang === "pt-BR" ? "com" : "with"} {nextSession.conductor.name}
                        </span>
                      )}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-gray-100 bg-white p-4 text-center">
                    <p className="text-sm text-gray-400">
                      {lang === "pt-BR"
                        ? "Sem sessão agendada no momento."
                        : "No session scheduled right now."}
                    </p>
                  </div>
                )}

                {recentSessions.length > 0 && (
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                      {lang === "pt-BR" ? "Histórico recente" : "Recent history"}
                    </p>
                    <ul className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                      {recentSessions.map((s, idx) => (
                        <li
                          key={s.id}
                          className={`flex items-center gap-3 px-4 py-3 ${idx < recentSessions.length - 1 ? "border-b border-gray-50" : ""}`}
                        >
                          <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-gray-50">
                            <span className="text-[9px] font-bold uppercase text-gray-500">
                              {new Date(s.sessionDate).toLocaleDateString(dateLocale, { month: "short" })}
                            </span>
                            <span className="text-sm font-extrabold leading-none text-gray-900 tabular-nums">
                              {new Date(s.sessionDate).getDate()}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-gray-900">{s.sessionType}</p>
                            <p className="text-[11px] text-gray-400">
                              {s.conductor?.name ?? (lang === "pt-BR" ? "Sem condutor" : "No conductor")}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              s.status === "REALIZADO"
                                ? "bg-green-50 text-green-700"
                                : s.status === "NO_SHOW"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {s.status === "REALIZADO"
                              ? (lang === "pt-BR" ? "Realizada" : "Done")
                              : s.status === "NO_SHOW"
                                ? "No-show"
                                : s.status === "REMARCADO"
                                  ? (lang === "pt-BR" ? "Remarcada" : "Rescheduled")
                                  : s.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left: Onboarding timeline */}
        <div>
          <h2 className="text-sm font-bold text-gray-900 mb-3">{t(lang, "programa.onboardingJourney")}</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                className={`flex items-center gap-4 px-5 py-4 ${
                  idx < steps.length - 1 ? "border-b border-gray-50" : ""
                } ${step.status === "current" ? "bg-orange-50/50" : ""}`}
              >
                {/* Status icon */}
                <div className="shrink-0">
                  {step.status === "completed" ? (
                    <div className="w-7 h-7 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : step.status === "current" ? (
                    <div className="w-7 h-7 bg-brand-tangerina rounded-full flex items-center justify-center ring-4 ring-orange-100">
                      <div className="w-2.5 h-2.5 bg-white rounded-full" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 bg-gray-100 rounded-full border-2 border-gray-200" />
                  )}
                </div>

                {/* Label + detail */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${
                    step.status === "current" ? "text-brand-tangerina" :
                    step.status === "completed" ? "text-gray-900" : "text-gray-400"
                  }`}>
                    {step.label}
                  </p>
                  <p className={`text-xs mt-0.5 ${step.status === "pending" ? "text-gray-300" : "text-gray-500"}`}>
                    {step.detail}
                  </p>
                </div>

                {/* Optional badge */}
                {step.badge && <div className="shrink-0">{step.badge}</div>}
                {step.status === "current" && (
                  <span className="shrink-0 bg-brand-tangerina text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {lang === "pt-BR" ? "Atual" : "Current"}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right: Forms + English test */}
        <div className="space-y-5">
          {/* Forms */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">{t(lang, "programa.formsTitle")}</h2>
            {formAssignments.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <p className="text-sm text-gray-400">{t(lang, "forms.noForms")}</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {[...pendingAssignments, ...completedAssignments].map((a, idx, arr) => {
                  const tpl = FORM_TEMPLATES[a.templateId];
                  const title = lang === "pt-BR" ? tpl?.titlePt : tpl?.title;
                  const isPending = a.status !== FormAssignmentStatus.COMPLETED;
                  return (
                    <div
                      key={a.id}
                      className={`flex items-center gap-3 px-5 py-3.5 ${idx < arr.length - 1 ? "border-b border-gray-50" : ""}`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isPending ? "bg-brand-tangerina" : "bg-green-500"}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isPending ? "text-gray-900" : "text-gray-400"}`}>
                          {title ?? a.templateId}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(a.assignedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
                        </p>
                      </div>
                      {isPending ? (
                        <Link
                          href={`/hub/forms/${a.id}`}
                          className="shrink-0 bg-orange-50 text-brand-tangerina text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-orange-100 transition-colors"
                        >
                          {t(lang, "programa.fillNow")}
                        </Link>
                      ) : (
                        <span className="shrink-0 bg-green-50 text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg">
                          ✓ {t(lang, "programa.submitted")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* English test card */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">{t(lang, "programa.testTitle")}</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              {englishLevel ? (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-lg font-extrabold text-blue-600">{englishLevel.cefrLevel}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{englishLevel.displayLevel}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {englishLevel.createdAt
                          ? new Date(englishLevel.createdAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
                          : ""}
                        {"score" in englishLevel && englishLevel.score != null
                          ? ` · ${englishLevel.score}/100`
                          : "totalScore" in englishLevel && englishLevel.totalScore != null && englishLevel.questionCount != null
                          ? ` · ${englishLevel.totalScore}/${englishLevel.questionCount}`
                          : ""}
                      </p>
                    </div>
                  </div>

                  {/* Section bars */}
                  {sectionScores && (
                    <div className="space-y-1.5">
                      {Object.entries(sectionScores).map(([section, score]) => (
                        <div key={section} className="flex items-center gap-3">
                          <p className="text-[10px] text-gray-400 w-20 truncate">{section}</p>
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${score >= 3 ? "bg-green-500" : "bg-red-400"}`}
                              style={{ width: `${(score / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 w-6 text-right">{score}/5</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Link
                    href={englishLevelSource === "realtime" ? "/hub/test/realtime/result" : "/hub/test/result"}
                    className="block mt-4 text-xs text-gray-400 hover:text-gray-600 underline text-right"
                  >
                    {t(lang, "programa.viewResult")}
                  </Link>
                </div>
              ) : (
                <div className="text-center py-2">
                  <p className="text-sm text-gray-400 mb-4">{t(lang, "programa.notTaken")}</p>
                  <Link
                    href="/hub/test"
                    className="inline-block bg-brand-tangerina text-white text-sm font-semibold px-6 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                  >
                    {t(lang, "programa.takeTest")}
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* AI mock interview card */}
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3">
              {lang === "pt-BR" ? "Mock interview" : "Mock interview"}
            </h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">
                    {lang === "pt-BR" ? "Entrevista AI ao vivo" : "Live AI interview"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {lang === "pt-BR"
                      ? "Treine uma entrevista corporativa baseada no seu CV e objetivo profissional."
                      : "Practice a corporate interview based on your CV and career goal."}
                  </p>
                </div>
                {mockInterview?.overallScore != null && (
                  <div className="shrink-0 rounded-xl bg-gray-50 px-3 py-2 text-center">
                    <p className="text-lg font-extrabold text-gray-900">{mockInterview.overallScore}</p>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">score</p>
                  </div>
                )}
              </div>

              {mockInterview ? (
                <div className="mt-4 rounded-xl bg-gray-50 p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-gray-500">
                      {mockInterview.targetRole || (lang === "pt-BR" ? "Foco do programa" : "Program focus")}
                    </span>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">
                      {mockInterview.hiringSignal || "reviewed"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    {mockInterview.completedAt
                      ? new Date(mockInterview.completedAt).toLocaleDateString(dateLocale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : ""}
                  </p>
                </div>
              ) : null}

              {enrollment ? (
                <Link
                  href="/hub/programa/mock-interview"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-brand-verde px-5 py-3 text-sm font-bold text-white transition hover:opacity-95 active:scale-[0.99]"
                >
                  {mockInterview
                    ? lang === "pt-BR" ? "Refazer treino AI" : "Run another AI practice"
                    : lang === "pt-BR" ? "Iniciar mock interview" : "Start mock interview"}
                </Link>
              ) : (
                <div className="mt-4 rounded-xl bg-gray-50 px-4 py-3 text-center text-xs font-medium text-gray-400">
                  {lang === "pt-BR"
                    ? "Disponível quando o programa estiver ativo."
                    : "Available when your program is active."}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
