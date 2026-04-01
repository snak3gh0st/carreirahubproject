import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContractStatus, InvoiceStatus, FormAssignmentStatus } from "@prisma/client";
import { t, Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

interface Step {
  id: string;
  label: string;
  status: "completed" | "current" | "pending";
  detail: string;
  icon: string;
}

export default async function HubStatusPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload?.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId = payload.customerId;

  const [contracts, invoices, formAssignments, placementTest, enrollment] = await Promise.all([
    prisma.contract.findMany({ where: { customerId }, select: { status: true, signedAt: true } }),
    prisma.invoice.findMany({ where: { customerId }, select: { status: true, paidAt: true } }),
    prisma.formAssignment.findMany({ where: { customerId }, select: { status: true } }),
    prisma.placementTest.findFirst({ where: { customerId }, orderBy: { createdAt: "desc" }, select: { displayLevel: true, cefrLevel: true } }),
    prisma.mentorshipEnrollment.findFirst({
      where: { customerId, status: "ACTIVE" },
      select: { currentPhase: { select: { label: true } } },
    }),
  ]);

  const contractSigned = contracts.some((c) => c.status === ContractStatus.SIGNED);
  const contractDate = contracts.find((c) => c.status === ContractStatus.SIGNED)?.signedAt;
  const anyPaid = invoices.some((i) => i.status === InvoiceStatus.PAID);
  const paidCount = invoices.filter((i) => i.status === InvoiceStatus.PAID).length;
  const totalInvoices = invoices.length;
  const totalForms = formAssignments.length;
  const completedForms = formAssignments.filter((f) => f.status === FormAssignmentStatus.COMPLETED).length;
  const onboardingDone = totalForms === 0 ? null : completedForms === totalForms;
  const testDone = !!placementTest;
  const allPriorDone = contractSigned && anyPaid && (onboardingDone === null || onboardingDone) && testDone;

  const steps: Step[] = [
    {
      id: "contract",
      label: t(lang, "status.contract"),
      status: contractSigned ? "completed" : "current",
      detail: contractSigned
        ? `${t(lang, "status.signed")}${contractDate ? ` ${new Date(contractDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}` : ""}`
        : t(lang, "status.pendingSignature"),
      icon: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    },
    {
      id: "payment",
      label: t(lang, "status.payment"),
      status: anyPaid ? "completed" : contractSigned ? "current" : "pending",
      detail: anyPaid ? `${paidCount}/${totalInvoices} ${t(lang, "status.invoicesPaid")}` : t(lang, "status.awaitingFirstPayment"),
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    },
  ];

  if (onboardingDone !== null) {
    steps.push({
      id: "onboarding",
      label: t(lang, "status.onboarding"),
      status: onboardingDone ? "completed" : anyPaid ? "current" : "pending",
      detail: onboardingDone ? t(lang, "status.allFormsCompleted") : `${completedForms}/${totalForms} ${t(lang, "status.forms")}`,
      icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
    });
  }

  steps.push({
    id: "english-test",
    label: t(lang, "status.englishTest"),
    status: testDone ? "completed" : anyPaid ? "current" : "pending",
    detail: testDone ? `${placementTest!.displayLevel} (${placementTest!.cefrLevel})` : t(lang, "status.notTakenYet"),
    icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253",
  });

  const currentPhaseLabel = enrollment?.currentPhase?.label ?? null;
  steps.push({
    id: "mentorship",
    label: t(lang, "status.mentorshipPhase"),
    status: currentPhaseLabel ? "current" : allPriorDone ? "current" : "pending",
    detail: currentPhaseLabel
      ? `${t(lang, "status.currentPhaseLabel")}: ${currentPhaseLabel}`
      : allPriorDone
      ? t(lang, "status.awaitingEnrollment")
      : t(lang, "status.completePreviousSteps"),
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
  });

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progress = Math.round((completedCount / steps.length) * 100);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "status.yourProgress")}</h1>
        <p className="text-gray-500 text-sm mt-1">{t(lang, "status.trackStatus")}</p>
      </div>

      {/* Progress bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">{t(lang, "status.overallProgress")}</span>
          <span className="text-sm font-bold" style={{ color: BRAND_COLORS.TANGERINA }}>{progress}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ backgroundColor: BRAND_COLORS.TANGERINA, width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, i) => {
          const isCompleted = step.status === "completed";
          const isCurrent = step.status === "current";

          return (
            <div
              key={step.id}
              className={`bg-white rounded-2xl shadow-sm border p-6 transition-colors ${
                isCurrent ? "border-2" : "border-gray-100"
              }`}
              style={isCurrent ? { borderColor: BRAND_COLORS.TANGERINA } : {}}
            >
              <div className="flex items-start gap-4">
                {/* Step icon */}
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: isCompleted ? "#ECFDF5" : isCurrent ? BRAND_COLORS.CREME : "#F3F4F6",
                  }}
                >
                  {isCompleted ? (
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg
                      className="w-6 h-6"
                      style={{ color: isCurrent ? BRAND_COLORS.TANGERINA : "#9CA3AF" }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={step.icon} />
                    </svg>
                  )}
                </div>

                {/* Step content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className={`font-semibold ${isCompleted ? "text-green-700" : isCurrent ? "text-gray-900" : "text-gray-400"}`}>
                      {step.label}
                    </h3>
                    {isCurrent && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-white" style={{ backgroundColor: BRAND_COLORS.TANGERINA }}>
                        {t(lang, "status.current")}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm mt-1 ${isCompleted ? "text-green-600" : isCurrent ? "text-gray-500" : "text-gray-400"}`}>
                    {step.detail}
                  </p>
                </div>

                {/* Step number */}
                <span className={`text-xs font-medium ${isCompleted ? "text-green-400" : "text-gray-300"}`}>
                  {i + 1}/{steps.length}
                </span>
              </div>

              {/* Connector line */}
              {i < steps.length - 1 && (
                <div className="ml-6 mt-4 h-4 border-l-2" style={{ borderColor: isCompleted ? "#059669" : "#E5E7EB" }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
