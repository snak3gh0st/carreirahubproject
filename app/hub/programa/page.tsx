import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { ContractStatus, InvoiceStatus, FormAssignmentStatus } from "@prisma/client";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";

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

  const [contracts, invoices, formAssignments, placementTest, enrollment, deal] = await Promise.all([
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
      where: { customerId },
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
    prisma.mentorshipEnrollment.findFirst({
      where: { customerId, status: "ACTIVE" },
      select: { currentPhase: { select: { label: true } } },
    }),
    prisma.deal.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      select: { title: true, createdAt: true },
    }),
  ]);

  // Onboarding step logic (mirrors status route)
  const contractSigned = contracts.some((c) => c.status === ContractStatus.SIGNED);
  const contractDate = contracts.find((c) => c.status === ContractStatus.SIGNED)?.signedAt;
  const anyPaid = invoices.some((i) => i.status === InvoiceStatus.PAID);
  const firstPaidDate = invoices.find((i) => i.status === InvoiceStatus.PAID)?.paidAt;
  const totalForms = formAssignments.length;
  const completedForms = formAssignments.filter((f) => f.status === FormAssignmentStatus.COMPLETED).length;
  const onboardingFormsApplicable = totalForms > 0;
  const onboardingDone = !onboardingFormsApplicable || completedForms === totalForms;
  const testDone = !!placementTest;
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
        ? `${placementTest!.cefrLevel} — ${placementTest!.displayLevel}`
        : t(lang, "programa.notTaken"),
      badge: testDone ? (
        <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
          {placementTest!.cefrLevel}
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
              {placementTest ? (
                <div>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
                      <span className="text-lg font-extrabold text-blue-600">{placementTest.cefrLevel}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">{placementTest.displayLevel}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {placementTest.createdAt
                          ? new Date(placementTest.createdAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
                          : ""}
                        {placementTest.totalScore != null && placementTest.questionCount != null
                          ? ` · ${placementTest.totalScore}/${placementTest.questionCount}`
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
                    href="/hub/test/result"
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
        </div>
      </div>
    </div>
  );
}
