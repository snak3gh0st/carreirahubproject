import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";

const GOLD = "#C9A84C";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: "#FFF8E7", text: "#B8962E", label: "Pending" },
    IN_PROGRESS: { bg: "#EFF6FF", text: "#2563EB", label: "In Progress" },
    COMPLETED: { bg: "#ECFDF5", text: "#059669", label: "Completed" },
  };
  const s = map[status] || map.PENDING!;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      {s.label}
    </span>
  );
}

export default async function HubFormsPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const assignments = await prisma.formAssignment.findMany({
    where: { customerId: payload.customerId },
    include: { submission: true },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
        <p className="text-gray-500 text-sm mt-1">Complete your onboarding forms below.</p>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">No forms assigned yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const tpl = FORM_TEMPLATES[a.templateId];
            return (
              <Link
                key={a.id}
                href={`/hub/forms/${a.id}`}
                className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{tpl?.title || a.templateId}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      Assigned {new Date(a.assignedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      {a.submission && ` · Submitted ${new Date(a.submission.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={a.status} />
                    {a.status !== "COMPLETED" && (
                      <span className="text-sm font-medium" style={{ color: GOLD }}>Fill Now →</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
