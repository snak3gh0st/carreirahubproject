import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { InvoiceStatus, FormAssignmentStatus } from "@prisma/client";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

function fmtAmount(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default async function HubHomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId: string = payload.customerId;

  const [invoices, placementTest, realtimeTest, formAssignments, enrollment, deal] = await Promise.all([
    prisma.invoice.findMany({
      where: { customerId },
      select: { id: true, status: true, amount: true, amountPaid: true, dueDate: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.placementTest.findFirst({
      where: { customerId, totalScore: { not: -1 } },
      orderBy: { createdAt: "desc" },
      select: { displayLevel: true, cefrLevel: true, createdAt: true },
    }),
    prisma.englishRealtimeTest.findFirst({
      where: { customerId, status: "COMPLETED" },
      orderBy: { createdAt: "desc" },
      select: { displayLevel: true, cefrLevel: true, createdAt: true },
    }),
    prisma.formAssignment.findMany({
      where: { customerId },
      select: { status: true },
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

  // Financials
  const openStatuses: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID];
  const openInvoices = invoices.filter((i) => openStatuses.includes(i.status));
  const totalDue = openInvoices.reduce(
    (sum, i) => sum + (Number(i.amount) - Number(i.amountPaid ?? 0)),
    0
  );
  const paidInvoices = invoices.filter((i) => i.status === InvoiceStatus.PAID);
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

  // Smart alert (priority: overdue > due-soon > forms)
  const overdueInv = invoices.find((i) => i.status === InvoiceStatus.OVERDUE);
  const soonInv = !overdueInv
    ? openInvoices.find((i) => {
        if (!i.dueDate || i.status !== InvoiceStatus.SENT) return false;
        const days = Math.ceil((new Date(i.dueDate).getTime() - Date.now()) / 86400000);
        return days >= 0 && days <= 7;
      })
    : undefined;
  const alertInv = overdueInv ?? soonInv;
  const pendingForms = formAssignments.filter(
    (f) => f.status !== FormAssignmentStatus.COMPLETED
  ).length;

  // Alert label
  const alertDays = alertInv?.dueDate
    ? Math.abs(Math.ceil((new Date(alertInv.dueDate).getTime() - Date.now()) / 86400000))
    : 0;
  const alertAmountDue = alertInv
    ? Number(alertInv.amount) - Number(alertInv.amountPaid ?? 0)
    : 0;

  // Program info
  const programName = deal?.title ?? "";
  const programSince = deal?.createdAt
    ? new Date(deal.createdAt).toLocaleDateString(dateLocale, { month: "short", year: "numeric" })
    : "";
  const phaseLabel = enrollment?.currentPhase?.label ?? "";
  const firstName = (payload.name as string | undefined)?.split(" ")[0]
    ?? (payload.email as string | undefined)?.split("@")[0]
    ?? "";
  const englishLevel =
    realtimeTest && (!placementTest || realtimeTest.createdAt > placementTest.createdAt)
      ? realtimeTest
      : placementTest;

  return (
    <div className="space-y-4">
      {/* Welcome hero */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6 flex items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {t(lang, "inicio.hello")}, {firstName} 👋
          </h1>
          {programName && (
            <p className="text-sm text-gray-500 mt-1 truncate">
              {programName}
              {programSince && (
                <> · {t(lang, "inicio.since")} {programSince}</>
              )}
            </p>
          )}
        </div>
        {phaseLabel && (
          <div className="shrink-0 bg-orange-50 rounded-xl px-4 py-3 text-center min-w-[88px]">
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1">
              {t(lang, "inicio.currentPhase")}
            </p>
            <p className="text-base font-bold text-brand-tangerina leading-tight">{phaseLabel}</p>
          </div>
        )}
      </div>

      {/* Smart alert */}
      {alertInv && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-red-700 truncate">
                {overdueInv
                  ? `${t(lang, "inicio.alertInvoiceOverdue")} — ${alertDays} ${t(lang, "financeiro.days")}`
                  : `${t(lang, "inicio.alertInvoiceDue")} — ${alertDays} ${t(lang, "financeiro.days")}`}
              </p>
              <p className="text-xs text-red-500 mt-0.5">${fmtAmount(alertAmountDue)}</p>
            </div>
          </div>
          <Link
            href={`/hub/pay/${alertInv.id}`}
            className="shrink-0 bg-red-500 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-red-600 transition-colors whitespace-nowrap"
          >
            {t(lang, "inicio.payNow")}
          </Link>
        </div>
      )}
      {!alertInv && pendingForms > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 bg-brand-tangerina rounded-full flex-shrink-0" />
            <p className="text-sm font-semibold text-orange-700">
              {pendingForms} {t(lang, "inicio.alertFormsPending")}
            </p>
          </div>
          <Link
            href="/hub/programa"
            className="shrink-0 bg-brand-tangerina text-white text-xs font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            {t(lang, "inicio.fillNow")}
          </Link>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.openBalance")}
          </p>
          <p className={`text-xl sm:text-2xl font-extrabold ${totalDue > 0 ? "text-red-600" : "text-green-600"}`}>
            ${fmtAmount(totalDue)}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {openInvoices.length} {t(lang, "inicio.invoice")}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.totalPaid")}
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-green-600">${fmtAmount(totalPaid)}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {paidInvoices.length} {t(lang, "inicio.installments")}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.englishLevel")}
          </p>
          {englishLevel?.cefrLevel && englishLevel?.displayLevel ? (
            <>
              <p className="text-xl sm:text-2xl font-extrabold text-blue-600">{englishLevel.cefrLevel}</p>
              <p className="text-[11px] text-gray-400 mt-1">{englishLevel.displayLevel}</p>
            </>
          ) : (
            <>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-300">—</p>
              <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.notTaken")}</p>
            </>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.pendingForms")}
          </p>
          <p className={`text-xl sm:text-2xl font-extrabold ${pendingForms > 0 ? "text-brand-tangerina" : "text-green-600"}`}>
            {pendingForms > 0 ? pendingForms : "✓"}
          </p>
          <p className="text-[11px] text-gray-400 mt-1">
            {pendingForms > 0 ? t(lang, "inicio.pending") : t(lang, "inicio.allDone")}
          </p>
        </div>
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/hub/financeiro"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center hover:border-gray-200 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">💰</div>
          <p className="text-sm font-semibold text-gray-900">{t(lang, "navigation.financeiro")}</p>
          <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.financeirotSubtitle")}</p>
        </Link>

        <Link
          href="/hub/programa"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center hover:border-gray-200 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">🎓</div>
          <p className="text-sm font-semibold text-gray-900">{t(lang, "navigation.programa")}</p>
          <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.programaSubtitle")}</p>
        </Link>

        <Link
          href="/hub/documentos"
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center hover:border-gray-200 hover:shadow-md transition-all"
        >
          <div className="text-2xl mb-2">📄</div>
          <p className="text-sm font-semibold text-gray-900">{t(lang, "navigation.documentos")}</p>
          <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.documentosSubtitle")}</p>
        </Link>

        {pendingForms > 0 ? (
          <Link
            href="/hub/programa"
            className="bg-gradient-to-br from-orange-50 to-white rounded-2xl border-2 border-brand-tangerina shadow-sm p-4 sm:p-5 text-center hover:opacity-90 transition-opacity"
          >
            <div className="text-2xl mb-2">📋</div>
            <p className="text-sm font-semibold text-brand-tangerina">
              {pendingForms} {t(lang, "inicio.pendingForms")}
            </p>
            <p className="text-[11px] text-orange-400 mt-1">{t(lang, "inicio.fillNow")}</p>
          </Link>
        ) : (
          <Link
            href="/hub/test"
            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 text-center hover:border-gray-200 hover:shadow-md transition-all"
          >
            <div className="text-2xl mb-2">🎯</div>
            <p className="text-sm font-semibold text-gray-900">{t(lang, "dashboard.englishTest")}</p>
            <p className="text-[11px] text-gray-400 mt-1">{t(lang, "inicio.testSubtitle")}</p>
          </Link>
        )}
      </div>
    </div>
  );
}
