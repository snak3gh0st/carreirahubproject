import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

function copyFor(lang: Language) {
  if (lang === "pt-BR") {
    return {
      title: "Resultado do teste por voz",
      taken: "Realizado",
      score: "Pontuacao",
      strengths: "Pontos fortes",
      focusAreas: "Focar agora",
      back: "Voltar ao painel",
      retake: "Novo teste por voz",
    };
  }

  return {
    title: "Voice test result",
    taken: "Taken",
    score: "Score",
    strengths: "Strengths",
    focusAreas: "Focus areas",
    back: "Back to dashboard",
    retake: "New voice test",
  };
}

export default async function RealtimeEnglishResultPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const copy = copyFor(lang);
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";

  const result = await prisma.englishRealtimeTest.findFirst({
    where: { customerId: payload.customerId, status: "COMPLETED" },
    orderBy: { createdAt: "desc" },
  });

  if (!result) redirect("/hub/test/realtime");

  const componentScores = [
    ["Fluency", result.fluencyScore ?? 0],
    ["Pronunciation", result.pronunciationScore ?? 0],
    ["Grammar", result.grammarScore ?? 0],
    ["Vocabulary", result.vocabularyScore ?? 0],
    ["Comprehension", result.comprehensionScore ?? 0],
  ];

  return (
    <div className="max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{copy.title}</h1>
        <p className="text-gray-500 text-sm">
          {copy.taken}{" "}
          {new Date(result.createdAt).toLocaleDateString(dateLocale, {
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center mb-6">
        <div
          className="inline-flex px-6 py-3 rounded-2xl text-2xl font-bold mb-3"
          style={{ backgroundColor: BRAND_COLORS.CREME, color: BRAND_COLORS.VERDE }}
        >
          {result.displayLevel}
        </div>
        <p className="text-gray-500 text-sm mt-2">
          CEFR: <span className="font-semibold text-gray-900">{result.cefrLevel}</span>
        </p>
        <p className="text-gray-400 text-sm mt-1">
          {copy.score}: {result.score ?? 0}/100
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <p className="text-sm text-gray-600">{result.summary}</p>

        <div className="space-y-4 mt-6">
          {componentScores.map(([label, score]) => (
            <div key={label}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-gray-600">{label}</span>
                <span className="font-semibold text-gray-900">{score}/10</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(Number(score) / 10) * 100}%`,
                    backgroundColor: BRAND_COLORS.TANGERINA,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-green-700 mb-3">{copy.strengths}</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {(result.strengths || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-xs font-bold uppercase tracking-wide text-orange-700 mb-3">{copy.focusAreas}</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {(result.focusAreas || []).map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      </div>

      <div className="flex gap-4">
        <Link
          href="/hub"
          className="flex-1 py-3 text-center rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition"
        >
          {copy.back}
        </Link>
        <Link
          href="/hub/test/realtime"
          className="flex-1 py-3 text-center rounded-xl text-white font-medium text-sm transition hover:opacity-90"
          style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
        >
          {copy.retake}
        </Link>
      </div>
    </div>
  );
}
