import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { ContractStatus, InvoiceStatus } from "@prisma/client";

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

export default async function DocumentosPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const customerId: string = payload.customerId;

  const [contracts, invoices] = await Promise.all([
    prisma.contract.findMany({
      where: { customerId, status: ContractStatus.SIGNED },
      select: {
        id: true,
        signedAt: true,
        signedUrl: true,
        signedS3Url: true,
        signedS3UrlExpiresAt: true,
        docusign_env_id: true,
        deal: { select: { title: true } },
      },
      orderBy: { signedAt: "desc" },
    }),
    prisma.invoice.findMany({
      where: { customerId, status: InvoiceStatus.PAID },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        paidAt: true,
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const hasDocuments = contracts.length > 0 || invoices.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "documentos.title")}</h1>
        <p className="text-sm text-gray-400 mt-1">{t(lang, "documentos.subtitle")}</p>
      </div>

      {!hasDocuments && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-brand-creme flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-400">{t(lang, "documentos.noDocuments")}</p>
        </div>
      )}

      {/* Contracts */}
      {contracts.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">📝</span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{t(lang, "documentos.contracts")}</h2>
              <p className="text-xs text-gray-400">{t(lang, "documentos.docusignVerified")}</p>
            </div>
          </div>
          <div className="space-y-3">
            {contracts.map((c) => {
              const hasAccessibleDocument = Boolean(c.signedS3Url || c.signedUrl || c.docusign_env_id);
              return (
                <div
                  key={c.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  {/* PDF icon */}
                  <div className="w-10 h-12 bg-gray-50 border border-gray-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-[8px] text-gray-400 font-bold mt-0.5">PDF</span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {c.deal?.title ?? t(lang, "status.contract")}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">
                        {t(lang, "documents.signedOn")}{" "}
                        {c.signedAt
                          ? new Date(c.signedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })
                          : ""}
                      </span>
                      <span className="text-[10px] text-green-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                        {t(lang, "documentos.docusignVerified")}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {hasAccessibleDocument ? (
                      <>
                        <a
                          href={`/api/hub/contracts/${c.id}?action=view`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                        >
                          {t(lang, "documentos.view")}
                        </a>
                        <a
                          href={`/api/hub/contracts/${c.id}?action=download`}
                          className="bg-brand-verde text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          {t(lang, "documentos.download")}
                        </a>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400">{t(lang, "documents.contactSupport")}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Receipts */}
      {invoices.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">🧾</span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{t(lang, "documentos.receipts")}</h2>
              <p className="text-xs text-gray-400">{invoices.length} {t(lang, "inicio.installments")}</p>
            </div>
          </div>
          <div className="space-y-3">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4"
              >
                {/* PDF badge */}
                <div className="w-9 h-11 bg-green-50 border border-green-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[8px] text-green-500 font-bold mt-0.5">PDF</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {inv.paidAt
                      ? new Date(inv.paidAt).toLocaleDateString(dateLocale, { month: "long", year: "numeric" })
                      : `#${inv.invoiceNumber ?? inv.id.slice(0, 8)}`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {inv.paidAt
                      ? new Date(inv.paidAt).toLocaleDateString(dateLocale, { day: "numeric", month: "short", year: "numeric" })
                      : ""}
                  </p>
                </div>

                {/* Amount */}
                <p className="text-sm font-bold text-green-600 flex-shrink-0">
                  ${fmtAmount(Number(inv.amount))}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    href={`/hub/documents/receipt/${inv.id}`}
                    className="border border-gray-200 text-gray-600 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                  >
                    {t(lang, "documentos.view")}
                  </Link>
                  <Link
                    href={`/hub/documents/receipt/${inv.id}`}
                    className="bg-green-50 border border-green-200 text-green-700 text-xs font-semibold px-3 py-2 rounded-lg hover:bg-green-100 transition-colors flex items-center gap-1 whitespace-nowrap"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    PDF
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
