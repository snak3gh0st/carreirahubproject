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

  const [contracts, invoices, materials] = await Promise.all([
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
    prisma.opsStudentDocument.findMany({
      where: { customerId, visibility: "STUDENT_VISIBLE" },
      select: {
        id: true,
        kind: true,
        title: true,
        filename: true,
        externalUrl: true,
        mimeType: true,
        sizeBytes: true,
        uploadedAt: true,
      },
      orderBy: { uploadedAt: "desc" },
    }),
  ]);

  const hasDocuments = contracts.length > 0 || invoices.length > 0 || materials.length > 0;

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

      {/* Materials from ops */}
      {materials.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl">📚</span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">
                {lang === "pt-BR" ? "Materiais de estudo" : "Study materials"}
              </h2>
              <p className="text-xs text-gray-400">
                {lang === "pt-BR"
                  ? "Documentos compartilhados pelo seu coach"
                  : "Documents shared by your coach"}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {materials.map((m) => {
              const title = m.title || m.filename;
              const isExternal = Boolean(m.externalUrl);
              return (
                <div
                  key={m.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                >
                  <div className="w-10 h-12 bg-brand-creme border border-amber-100 rounded-lg flex flex-col items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-brand-verde" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
                        {m.kind}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(m.uploadedAt).toLocaleDateString(dateLocale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      {isExternal && (
                        <span className="text-[10px] text-blue-600 font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full inline-block" />
                          {lang === "pt-BR" ? "Link externo" : "External link"}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a
                      href={`/api/hub/materials/${m.id}`}
                      target={isExternal ? "_blank" : undefined}
                      rel={isExternal ? "noopener noreferrer" : undefined}
                      className="bg-brand-verde text-white text-xs font-semibold px-3 py-2 rounded-xl hover:opacity-90 transition-opacity flex items-center gap-1.5"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isExternal
                          ? "M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                          : "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        } />
                      </svg>
                      {isExternal
                        ? (lang === "pt-BR" ? "Abrir" : "Open")
                        : (lang === "pt-BR" ? "Baixar" : "Download")}
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
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
