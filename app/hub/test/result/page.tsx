import { prisma } from "@/lib/db";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

const LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  Beginner: { bg: "#FEF2F2", text: "#DC2626" },
  Intermediate: { bg: BRAND_COLORS.CREME, text: BRAND_COLORS.VERDE },
  Advanced: { bg: "#EFF6FF", text: "#2563EB" },
  Fluent: { bg: "#ECFDF5", text: "#059669" },
};

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

export default async function HubTestResultPage() {
  const cookieStore = cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload?.language || "en") as Language;
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";

  const result = await prisma.placementTest.findFirst({
    where: { customerId: payload.customerId },
    orderBy: { createdAt: "desc" },
  });

  if (!result) redirect("/hub/test");

  const sectionScores = [
    result.section1Score,
    result.section2Score,
    result.section3Score,
    result.section4Score,
    result.section5Score,
  ];
  const sectionLabels = ["A1-A2", "A2-B1", "B1-B2", "B2-C1", "C1-C2"];
  const levelColor = LEVEL_COLORS[result.displayLevel] || LEVEL_COLORS.Beginner!;
  const minutes = result.timeSpentSeconds ? Math.round(result.timeSpentSeconds / 60) : null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{t(lang, "testResult.yourLevel")}</h1>
        <p className="text-gray-500 text-sm">
          {t(lang, "testResult.taken")} {new Date(result.createdAt).toLocaleDateString(dateLocale, { month: "long", day: "numeric", year: "numeric" })}
          {minutes && ` \u00b7 ${minutes} ${t(lang, "testResult.min")}`}
        </p>
      </div>

      {/* Level Badge */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mb-6">
        <div
          className="inline-flex px-6 py-3 rounded-2xl text-2xl font-bold mb-3"
          style={{ backgroundColor: levelColor.bg, color: levelColor.text }}
        >
          {result.displayLevel}
        </div>
        <p className="text-gray-500 text-sm mt-2">
          {t(lang, "testResult.cefrLevel")}: <span className="font-semibold text-gray-900">{result.cefrLevel}</span>
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {t(lang, "testResult.score")}: {result.totalScore}/25 ({Math.round(result.percentage)}%)
        </p>
      </div>

      {/* Section Breakdown */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">{t(lang, "testResult.sectionBreakdown")}</h2>
        <div className="space-y-4">
          {sectionScores.map((score, i) => (
            <div key={i}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600">
                  {t(lang, "testResult.section")} {i + 1} <span className="text-gray-400">({sectionLabels[i]})</span>
                </span>
                <span className={`font-semibold ${score >= 3 ? "text-green-600" : "text-red-500"}`}>
                  {score}/5
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(score / 5) * 100}%`,
                    backgroundColor: score >= 3 ? "var(--success-600, #059669)" : "var(--error-600, #DC2626)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Link
          href="/hub"
          className="flex-1 py-3 text-center rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition"
        >
          &larr; {t(lang, "testResult.backToDashboard")}
        </Link>
        <Link
          href="/hub/test"
          className="flex-1 py-3 text-center rounded-xl text-white font-medium text-sm transition hover:opacity-90 bg-brand-tangerina"
        >
          {t(lang, "testResult.retakeTest")}
        </Link>
      </div>
    </div>
  );
}
