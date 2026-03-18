import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { InvoiceStatus } from "@prisma/client";
import PrintButton from "../PrintButton";
import { t, Language } from "@/lib/i18n/hub";

const GOLD = "#C9A84C";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

interface Props {
  params: { invoiceId: string };
}

export default async function ReceiptPage({ params }: Props) {
  const cookieStore = cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload?.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";

  const invoice = await prisma.invoice.findUnique({
    where: { id: params.invoiceId },
    include: { customer: true },
  });

  if (!invoice || invoice.customerId !== payload.customerId) notFound();
  if (invoice.status !== InvoiceStatus.PAID) notFound();

  const amount = Number(invoice.amount);
  const amountPaid = Number(invoice.amountPaid || invoice.amount);

  return (
    <div className="max-w-2xl mx-auto">
      {/* Print button - hidden when printing */}
      <div className="flex justify-between items-center mb-6 print:hidden">
        <a href="/hub/documents" className="text-sm text-gray-500 hover:underline">&larr; {t(lang, "receipt.backToDocuments")}</a>
        <PrintButton lang={lang} />
      </div>

      {/* Receipt */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 print:shadow-none print:border-none print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Carreira U.S.A.</h1>
            <p className="text-sm text-gray-400 mt-1">{t(lang, "receipt.paymentReceipt")}</p>
          </div>
          <div className="text-right">
            <div className="inline-flex px-3 py-1 rounded-full text-sm font-semibold bg-green-50 text-green-600">
              {t(lang, "dashboard.paid").toUpperCase()}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">{t(lang, "receipt.billTo")}</p>
            <p className="font-medium text-gray-900">{invoice.customer.name}</p>
            <p className="text-sm text-gray-500">{invoice.customer.email}</p>
            {invoice.customer.address && (
              <p className="text-sm text-gray-500 mt-1">{invoice.customer.address}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-2">{t(lang, "receipt.invoiceDetails")}</p>
            <p className="text-sm text-gray-700">
              <span className="text-gray-400">{t(lang, "receipt.number")}:</span>{" "}
              <span className="font-medium">#{invoice.invoiceNumber || invoice.id.slice(0, 8)}</span>
            </p>
            <p className="text-sm text-gray-700 mt-1">
              <span className="text-gray-400">{t(lang, "receipt.datePaid")}:</span>{" "}
              <span className="font-medium">
                {invoice.paidAt
                  ? new Date(invoice.paidAt).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })
                  : "\u2014"}
              </span>
            </p>
            {invoice.paymentMethod && (
              <p className="text-sm text-gray-700 mt-1">
                <span className="text-gray-400">{t(lang, "receipt.method")}:</span>{" "}
                <span className="font-medium capitalize">{invoice.paymentMethod.replace(/_/g, " ")}</span>
              </p>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 text-xs text-gray-400 uppercase tracking-wide font-medium">{t(lang, "receipt.description")}</th>
                <th className="text-right py-3 text-xs text-gray-400 uppercase tracking-wide font-medium">{t(lang, "receipt.amount")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lineItems && Array.isArray(invoice.lineItems) ? (
                (invoice.lineItems as any[]).map((item: any, i: number) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-3 text-gray-700">{item.description || t(lang, "receipt.service")}</td>
                    <td className="py-3 text-right text-gray-900 font-medium">
                      ${Number(item.amount || item.unitPrice || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-gray-50">
                  <td className="py-3 text-gray-700">{t(lang, "receipt.service")}</td>
                  <td className="py-3 text-right text-gray-900 font-medium">
                    ${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Total */}
        <div className="flex justify-end">
          <div className="w-64">
            <div className="flex justify-between py-2 text-sm">
              <span className="text-gray-500">{t(lang, "receipt.subtotal")}</span>
              <span className="text-gray-900">${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between py-3 border-t-2 border-gray-900">
              <span className="font-bold text-gray-900">{t(lang, "receipt.amountPaid")}</span>
              <span className="font-bold text-lg" style={{ color: GOLD }}>
                ${amountPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            {t(lang, "receipt.footer")}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {t(lang, "receipt.thankYou")}
          </p>
        </div>
      </div>
    </div>
  );
}
