import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InvoiceStatus, FormAssignmentStatus } from "@prisma/client";
import { t, Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

function getPayload(token: string) {
  try {
    const [, payloadB64] = token.split(".");
    return JSON.parse(Buffer.from(payloadB64!, "base64url").toString());
  } catch {
    return null;
  }
}

function StatusBadge({ status, lang }: { status: InvoiceStatus; lang: Language }) {
  const map: Record<string, { bg: string; text: string; labelKey: "dashboard.paid" | "dashboard.pending" | "dashboard.overdue" | "dashboard.partial" | "dashboard.upcoming" }> = {
    PAID: { bg: "#ECFDF5", text: "#059669", labelKey: "dashboard.paid" },
    SENT: { bg: BRAND_COLORS.CREME, text: BRAND_COLORS.VERDE, labelKey: "dashboard.pending" },
    OVERDUE: { bg: "#FEF2F2", text: "#DC2626", labelKey: "dashboard.overdue" },
    PARTIALLY_PAID: { bg: "#FFF7ED", text: "#EA580C", labelKey: "dashboard.partial" },
    DRAFT: { bg: "#F3F4F6", text: "#6B7280", labelKey: "dashboard.upcoming" },
  };
  const s = map[status] || map.DRAFT!;
  return (
    <span
      className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {t(lang, s.labelKey)}
    </span>
  );
}

export default async function HubDashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");

  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload?.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";

  const customer = await prisma.customer.findUnique({
    where: { id: payload.customerId },
  });

  const invoices = await prisma.invoice.findMany({
    where: { customerId: payload.customerId },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      amountPaid: true,
      status: true,
      dueDate: true,
      paidAt: true,
    },
  });

  const payableStatuses: InvoiceStatus[] = [
    InvoiceStatus.SENT,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.PARTIALLY_PAID,
  ];
  const unpaid = invoices.filter((i) => payableStatuses.includes(i.status));
  const totalDue = unpaid.reduce(
    (sum, i) => sum + Number(i.amount) - Number(i.amountPaid || 0),
    0
  );
  const paidInvoices = invoices.filter((i) => i.status === InvoiceStatus.PAID);
  const totalPaid = paidInvoices.reduce(
    (sum, i) => sum + Number(i.amountPaid || i.amount),
    0
  );
  const nextDue = unpaid.length > 0 ? unpaid[0]!.dueDate : null;
  const canPay = (status: InvoiceStatus) => payableStatuses.includes(status);
  const firstName = customer?.name?.split(" ")[0] || "Client";

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t(lang, "dashboard.welcome")}, {firstName}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {t(lang, "dashboard.overview")}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-red-50">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{t(lang, "dashboard.totalDue")}</p>
              <p className="text-2xl font-bold mt-0.5" style={{ color: totalDue > 0 ? "#DC2626" : "#059669" }}>
                ${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{t(lang, "dashboard.totalPaid")}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">
                ${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-creme">
              <svg className="w-5 h-5 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{t(lang, "dashboard.nextDue")}</p>
              <p className="text-2xl font-bold text-gray-900 mt-0.5">
                {nextDue
                  ? new Date(nextDue).toLocaleDateString(dateLocale, {
                      month: "short",
                      day: "numeric",
                    })
                  : "\u2014"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
        <Link href="/hub/status" className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 hover:border-gray-200 transition-colors text-center">
          <svg className="w-6 h-6 mx-auto mb-2 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-xs font-medium text-gray-600">{t(lang, "dashboard.myProgress")}</p>
        </Link>
        <Link href="/hub/documents" className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 hover:border-gray-200 transition-colors text-center">
          <svg className="w-6 h-6 mx-auto mb-2 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <p className="text-xs font-medium text-gray-600">{t(lang, "dashboard.documents")}</p>
        </Link>
        <Link href="/hub/forms" className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 hover:border-gray-200 transition-colors text-center">
          <svg className="w-6 h-6 mx-auto mb-2 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-xs font-medium text-gray-600">{t(lang, "dashboard.forms")}</p>
        </Link>
        <Link href="/hub/test" className="bg-white rounded-2xl shadow-sm p-4 border border-gray-100 hover:border-gray-200 transition-colors text-center">
          <svg className="w-6 h-6 mx-auto mb-2 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <p className="text-xs font-medium text-gray-600">{t(lang, "dashboard.englishTest")}</p>
        </Link>
      </div>

      {/* Forms + English Level Cards */}
      <FormsAndTestCards customerId={payload.customerId} lang={lang} />

      {/* Invoice List */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t(lang, "dashboard.invoices")}</h2>
        <span className="text-sm text-gray-400">{invoices.length} {t(lang, "dashboard.total")}</span>
      </div>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center bg-brand-creme">
            <svg className="w-8 h-8 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500">{t(lang, "dashboard.noInvoicesYet")}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {invoices.map((inv) => {
              const remaining = Number(inv.amount) - Number(inv.amountPaid || 0);
              return (
                <div
                  key={inv.id}
                  className="px-6 py-5 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    {/* Status dot */}
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor:
                          inv.status === "PAID"
                            ? "#059669"
                            : inv.status === "OVERDUE"
                            ? "#DC2626"
                            : inv.status === "SENT"
                            ? BRAND_COLORS.TANGERINA
                            : "#9CA3AF",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        #{inv.invoiceNumber || inv.id.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {inv.status === InvoiceStatus.PAID && inv.paidAt
                          ? `${t(lang, "dashboard.paid")} ${new Date(inv.paidAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}`
                          : `${t(lang, "dashboard.nextDue")} ${new Date(inv.dueDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-5 flex-shrink-0">
                    <StatusBadge status={inv.status} lang={lang} />

                    <div className="text-right w-24">
                      <p className="font-semibold text-gray-900 text-sm">
                        ${Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                      {inv.status === InvoiceStatus.PARTIALLY_PAID && (
                        <p className="text-xs text-orange-500 mt-0.5">
                          ${remaining.toLocaleString("en-US", { minimumFractionDigits: 2 })} {t(lang, "dashboard.left")}
                        </p>
                      )}
                    </div>

                    {canPay(inv.status) ? (
                      <Link
                        href={`/hub/pay/${inv.id}`}
                        className="px-4 py-2 rounded-lg text-white text-xs font-semibold transition hover:opacity-90 whitespace-nowrap bg-brand-tangerina"
                      >
                        {t(lang, "dashboard.payNow")}
                      </Link>
                    ) : (
                      <div className="w-[76px]" /> /* spacer to align columns */
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// -- Forms + English Level Cards --

async function FormsAndTestCards({ customerId, lang }: { customerId: string; lang: Language }) {
  const [pendingForms, latestTest] = await Promise.all([
    prisma.formAssignment.count({
      where: { customerId, status: FormAssignmentStatus.PENDING },
    }),
    prisma.placementTest.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const totalForms = await prisma.formAssignment.count({ where: { customerId } });
  // Always show -- at minimum the English Test card should be visible

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
      {/* Forms Card */}
      {totalForms > 0 && (
        <Link
          href="/hub/forms"
          className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:border-gray-200 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-50">
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{t(lang, "dashboard.forms")}</p>
              {pendingForms > 0 ? (
                <p className="text-sm font-semibold text-brand-verde">{pendingForms} {t(lang, "dashboard.pending")}</p>
              ) : (
                <p className="text-sm font-semibold text-green-600">{t(lang, "dashboard.allCompleted")}</p>
              )}
            </div>
          </div>
          <p className="text-xs mt-3 text-brand-verde">
            {pendingForms > 0 ? `${t(lang, "dashboard.fillNow")} \u2192` : `${t(lang, "dashboard.view")} \u2192`}
          </p>
        </Link>
      )}

      {/* English Level Card */}
      <Link
        href={latestTest ? "/hub/test/result" : "/hub/test"}
        className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:border-gray-200 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-brand-creme">
            <svg className="w-5 h-5 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{t(lang, "dashboard.englishLevel")}</p>
            {latestTest ? (
              <p className="text-sm font-semibold text-gray-900">
                {latestTest.displayLevel} <span className="text-gray-400 font-normal">&middot; {latestTest.cefrLevel} &middot; {latestTest.totalScore}/25</span>
              </p>
            ) : (
              <p className="text-sm font-semibold text-gray-400">{t(lang, "dashboard.notTakenYet")}</p>
            )}
          </div>
        </div>
        <p className="text-xs mt-3 text-brand-verde">
          {latestTest ? `${t(lang, "dashboard.retake")} \u2192` : `${t(lang, "dashboard.takeTest")} \u2192`}
        </p>
      </Link>
    </div>
  );
}
