import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ContractStatus, InvoiceStatus } from "@prisma/client";

const GOLD = "#C9A84C";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

export default async function HubDocumentsPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const customerId = payload.customerId;

  const [contracts, invoices] = await Promise.all([
    prisma.contract.findMany({
      where: { customerId, status: ContractStatus.SIGNED },
      select: {
        id: true,
        signedAt: true,
        signedS3Url: true,
        signedS3UrlExpiresAt: true,
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
        quickbooks_invoice_id: true,
      },
      orderBy: { paidAt: "desc" },
    }),
  ]);

  const hasDocuments = contracts.length > 0 || invoices.length > 0;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 text-sm mt-1">Download your signed contracts and payment receipts.</p>
      </div>

      {!hasDocuments ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: "#FFF8E7" }}>
            <svg className="w-8 h-8" style={{ color: GOLD }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-500">No documents available yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Signed Contracts */}
          {contracts.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                Signed Contracts
              </h2>
              <div className="space-y-3">
                {contracts.map((c) => (
                  <div
                    key={c.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-green-50">
                        <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          {c.deal?.title || "Contract"}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Signed {c.signedAt ? new Date(c.signedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        </p>
                      </div>
                    </div>
                    {c.signedS3Url && (!c.signedS3UrlExpiresAt || new Date(c.signedS3UrlExpiresAt) > new Date()) ? (
                      <a
                        href={c.signedS3Url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-lg text-sm font-medium transition hover:opacity-90"
                        style={{ backgroundColor: "#FFF8E7", color: GOLD }}
                      >
                        Download PDF
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Contact support</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Receipts */}
          {invoices.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                Payment Receipts
              </h2>
              <div className="space-y-3">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#FFF8E7" }}>
                        <svg className="w-5 h-5" style={{ color: GOLD }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">
                          Invoice #{inv.invoiceNumber || inv.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          ${Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })} — Paid {inv.paidAt ? new Date(inv.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""}
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-600">
                      Paid
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
