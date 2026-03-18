import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { InvoiceStatus } from "@prisma/client";

const GOLD = "#C9A84C";

function getPayload(token: string) {
  try {
    const [, payloadB64] = token.split(".");
    return JSON.parse(Buffer.from(payloadB64!, "base64url").toString());
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    PAID: { bg: "#ECFDF5", text: "#059669", label: "Paid" },
    SENT: { bg: "#FFF8E7", text: "#B8962E", label: "Pending" },
    OVERDUE: { bg: "#FEF2F2", text: "#DC2626", label: "Overdue" },
    PARTIALLY_PAID: { bg: "#FFF7ED", text: "#EA580C", label: "Partial" },
    DRAFT: { bg: "#F3F4F6", text: "#6B7280", label: "Upcoming" },
  };
  const s = map[status] || map.DRAFT!;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

export default async function HubDashboardPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");

  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

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

  const payableStatuses: InvoiceStatus[] = [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIALLY_PAID];
  const unpaid = invoices.filter((i) => payableStatuses.includes(i.status));
  const totalDue = unpaid.reduce((sum, i) => sum + Number(i.amount) - Number(i.amountPaid || 0), 0);
  const totalPaid = invoices
    .filter((i) => i.status === InvoiceStatus.PAID)
    .reduce((sum, i) => sum + Number(i.amountPaid || i.amount), 0);
  const nextDue = unpaid.length > 0 ? unpaid[0]!.dueDate : null;
  const canPay = (status: InvoiceStatus) => payableStatuses.includes(status);

  return (
    <div>
      {/* Welcome */}
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Welcome, {customer?.name?.split(" ")[0] || "Client"}
      </h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Due</p>
          <p className="text-2xl font-bold" style={{ color: totalDue > 0 ? "#DC2626" : "#059669" }}>
            ${totalDue.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Total Paid</p>
          <p className="text-2xl font-bold text-gray-900">
            ${totalPaid.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Next Due</p>
          <p className="text-2xl font-bold text-gray-900">
            {nextDue
              ? new Date(nextDue).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              : "—"}
          </p>
        </div>
      </div>

      {/* Invoice List */}
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoices</h2>

      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-500">
          No invoices yet.
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-100">
            {invoices.map((inv) => (
              <div key={inv.id} className="px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      #{inv.invoiceNumber || inv.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {inv.status === InvoiceStatus.PAID && inv.paidAt
                        ? `Paid ${new Date(inv.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : `Due ${new Date(inv.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </p>
                  </div>
                  <StatusBadge status={inv.status} />
                </div>

                <div className="flex items-center gap-4">
                  <p className="font-semibold text-gray-900">
                    ${Number(inv.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </p>
                  {canPay(inv.status) && (
                    <Link
                      href={`/hub/pay/${inv.id}`}
                      className="px-4 py-2 rounded-lg text-white text-sm font-medium transition"
                      style={{ backgroundColor: GOLD }}
                    >
                      Pay Now
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
