import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { InvoiceStatus } from "@prisma/client";

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

export default async function FinanceiroPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId: string = payload.customerId;

  const invoices = await prisma.invoice.findMany({
    where: { customerId },
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      amount: true,
      amountPaid: true,
      dueDate: true,
      paidAt: true,
    },
    orderBy: { dueDate: "asc" },
  });

  // Segment invoices
  const openStatuses: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID];
  const openInvoices = invoices.filter((i) => openStatuses.includes(i.status));
  const paidInvoices = invoices
    .filter((i) => i.status === InvoiceStatus.PAID)
    .sort((a, b) => new Date(b.paidAt ?? 0).getTime() - new Date(a.paidAt ?? 0).getTime());

  const totalDue = openInvoices.reduce(
    (sum, i) => sum + (Number(i.amount) - Number(i.amountPaid ?? 0)),
    0
  );
  const totalPaid = paidInvoices.reduce((sum, i) => sum + Number(i.amount), 0);

  // Next due (earliest unpaid)
  const nextDue = invoices
    .filter((i) => i.status === InvoiceStatus.SENT && i.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];

  // Installment bar colors per invoice
  function barColor(status: InvoiceStatus) {
    if (status === InvoiceStatus.PAID) return "bg-green-500";
    if (status === InvoiceStatus.OVERDUE) return "bg-red-500";
    if (status === InvoiceStatus.PARTIALLY_PAID) return "bg-yellow-400";
    if (status === InvoiceStatus.SENT) {
      // check if due soon (≤7 days)
      return "bg-orange-400";
    }
    return "bg-gray-200";
  }

  // Days status for open invoices
  function daysStatus(inv: (typeof invoices)[0]) {
    if (!inv.dueDate) return null;
    const days = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000);
    if (inv.status === InvoiceStatus.OVERDUE || days < 0) {
      return {
        label: `${t(lang, "financeiro.overdueBy")} ${Math.abs(days)} ${t(lang, "financeiro.days")}`,
        badgeClass: "bg-red-50 text-red-700",
        borderClass: "border-red-300",
      };
    }
    if (days <= 7) {
      return {
        label: `${t(lang, "financeiro.dueIn")} ${days} ${t(lang, "financeiro.days")}`,
        badgeClass: "bg-orange-50 text-orange-700",
        borderClass: "border-orange-300",
      };
    }
    return {
      label: `${t(lang, "financeiro.dueIn")} ${days} ${t(lang, "financeiro.days")}`,
      badgeClass: "bg-gray-100 text-gray-600",
      borderClass: "border-gray-200",
    };
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">{t(lang, "financeiro.title")}</h1>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.openBalance")}
          </p>
          <p className={`text-xl sm:text-2xl font-extrabold ${totalDue > 0 ? "text-red-600" : "text-green-600"}`}>
            ${fmtAmount(totalDue)}
          </p>
          {totalDue > 0 && (
            <p className="text-[11px] text-red-400 mt-1">
              {openInvoices.length} {t(lang, "inicio.invoice")}
            </p>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "inicio.totalPaid")}
          </p>
          <p className="text-xl sm:text-2xl font-extrabold text-green-600">${fmtAmount(totalPaid)}</p>
          <p className="text-[11px] text-gray-400 mt-1">
            {paidInvoices.length} {t(lang, "inicio.installments")}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t(lang, "financeiro.nextDue")}
          </p>
          {nextDue?.dueDate ? (
            <>
              <p className="text-xl sm:text-2xl font-extrabold text-gray-900">
                {new Date(nextDue.dueDate).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}
              </p>
              <p className="text-[11px] text-gray-400 mt-1">${fmtAmount(Number(nextDue.amount) - Number(nextDue.amountPaid ?? 0))}</p>
            </>
          ) : (
            <p className="text-xl sm:text-2xl font-extrabold text-gray-300">—</p>
          )}
        </div>
      </div>

      {/* Installment progress bar */}
      {invoices.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 sm:p-6">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-bold text-gray-900">{t(lang, "financeiro.installmentPlan")}</p>
            <p className="text-xs text-gray-400">
              {paidInvoices.length} {t(lang, "financeiro.paidInstallments")} ·{" "}
              {openInvoices.length} {t(lang, "financeiro.openInstallments")} ·{" "}
              {invoices.length - paidInvoices.length - openInvoices.length}{" "}
              {t(lang, "financeiro.futureInstallments")} · {t(lang, "financeiro.total")} $
              {fmtAmount(invoices.reduce((s, i) => s + Number(i.amount), 0))}
            </p>
          </div>
          <div className="flex gap-0.5 h-2">
            {invoices.map((inv, idx) => (
              <div
                key={inv.id}
                className={`flex-1 h-full ${barColor(inv.status)} ${
                  idx === 0 ? "rounded-l-full" : ""
                } ${idx === invoices.length - 1 ? "rounded-r-full" : ""}`}
                title={`${inv.invoiceNumber ?? inv.id.slice(0, 8)} — ${inv.status}`}
              />
            ))}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="text-[10px] text-green-600 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
              {t(lang, "financeiro.paidInstallments")} ({paidInvoices.length})
            </span>
            {openInvoices.length > 0 && (
              <span className="text-[10px] text-red-600 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                {t(lang, "financeiro.openInstallments")} ({openInvoices.length})
              </span>
            )}
            <span className="text-[10px] text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-gray-200 inline-block" />
              {t(lang, "financeiro.futureInstallments")} ({invoices.length - paidInvoices.length - openInvoices.length})
            </span>
          </div>
        </div>
      )}

      {/* Open invoices */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          {t(lang, "financeiro.openInvoices")}
        </h2>
        {openInvoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-sm text-gray-400">{t(lang, "financeiro.noOpenInvoices")}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {openInvoices.map((inv) => {
              const ds = daysStatus(inv);
              const amountDue = Number(inv.amount) - Number(inv.amountPaid ?? 0);
              return (
                <div
                  key={inv.id}
                  className={`bg-white rounded-2xl border-2 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4 ${ds?.borderClass ?? "border-gray-200"}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-gray-900">
                        #{inv.invoiceNumber ?? inv.id.slice(0, 8)}
                      </span>
                      {ds && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ${ds.badgeClass}`}>
                          {ds.label}
                        </span>
                      )}
                    </div>
                    {inv.dueDate && (
                      <p className="text-xs text-gray-400">
                        {new Date(inv.dueDate).toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6">
                    <p className="text-xl font-extrabold text-red-600">${fmtAmount(amountDue)}</p>
                    <Link
                      href={`/hub/pay/${inv.id}`}
                      className="bg-red-500 hover:bg-red-600 transition-colors text-white text-sm font-semibold px-5 py-2.5 rounded-xl whitespace-nowrap"
                    >
                      {t(lang, "inicio.payNow")}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Payment history */}
      <div>
        <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          {t(lang, "financeiro.paymentHistory")}
        </h2>
        {paidInvoices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 text-center">
            <p className="text-sm text-gray-400">{t(lang, "financeiro.noHistory")}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {paidInvoices.map((inv, idx) => (
              <div
                key={inv.id}
                className={`flex items-center gap-4 px-5 py-3.5 ${idx < paidInvoices.length - 1 ? "border-b border-gray-50" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">
                    #{inv.invoiceNumber ?? inv.id.slice(0, 8)}
                  </p>
                  {inv.paidAt && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(inv.paidAt).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
                <p className="text-sm font-bold text-green-600">${fmtAmount(Number(inv.amount))}</p>
                <span className="bg-green-50 text-green-700 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide hidden sm:block">
                  {t(lang, "dashboard.paid")}
                </span>
                <Link
                  href={`/hub/documents/receipt/${inv.id}`}
                  className="text-xs text-gray-400 hover:text-gray-600 underline whitespace-nowrap"
                >
                  {t(lang, "financeiro.receiptLink")}
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
