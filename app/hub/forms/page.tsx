import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";
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

function StatusBadge({ status, lang }: { status: string; lang: Language }) {
  const map: Record<string, { bg: string; text: string; labelKey: "forms.statusPending" | "forms.statusInProgress" | "forms.statusCompleted" }> = {
    PENDING: { bg: BRAND_COLORS.CREME, text: BRAND_COLORS.VERDE, labelKey: "forms.statusPending" },
    IN_PROGRESS: { bg: "#EFF6FF", text: "#2563EB", labelKey: "forms.statusInProgress" },
    COMPLETED: { bg: "#ECFDF5", text: "#059669", labelKey: "forms.statusCompleted" },
  };
  const s = map[status] || map.PENDING!;
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: s.bg, color: s.text }}>
      {t(lang, s.labelKey)}
    </span>
  );
}

export default async function HubFormsPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload?.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";

  const assignments = await prisma.formAssignment.findMany({
    where: { customerId: payload.customerId },
    include: { submission: true },
    orderBy: { assignedAt: "desc" },
  });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t(lang, "forms.title")}</h1>
        <p className="text-gray-500 text-sm mt-1">{t(lang, "forms.subtitle")}</p>
      </div>

      {assignments.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
          <p className="text-gray-500">{t(lang, "forms.noForms")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {assignments.map((a) => {
            const tpl = FORM_TEMPLATES[a.templateId];
            const title = lang === "pt-BR" ? tpl?.titlePt : tpl?.title;
            return (
              <Link
                key={a.id}
                href={`/hub/forms/${a.id}`}
                className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:border-gray-200 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{title || a.templateId}</h3>
                    <p className="text-sm text-gray-400 mt-1">
                      {t(lang, "forms.assigned")} {new Date(a.assignedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric", year: "numeric" })}
                      {a.submission && ` \u00b7 ${t(lang, "forms.submitted")} ${new Date(a.submission.submittedAt).toLocaleDateString(dateLocale, { month: "short", day: "numeric" })}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={a.status} lang={lang} />
                    {a.status !== "COMPLETED" && (
                      <span className="text-sm font-medium text-brand-verde">{t(lang, "forms.fillNow")} &rarr;</span>
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
