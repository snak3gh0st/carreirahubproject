import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";
import { normalizeRealtimeEnglishTranscript } from "@/lib/hub/realtime-english-test-flow";
import { buildRealtimeEnglishReportArtifacts } from "@/lib/hub/realtime-english-test-analysis";

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
      delivery: "Leitura do avaliador",
      fillerWords: "Filler words",
      pace: "Ritmo e velocidade",
      tonePresence: "Clareza e presenca",
      examinerRead: "Leitura final do avaliador",
      conversationMetrics: "Metricas da conversa",
      answers: "Respostas consideradas",
      totalWords: "Palavras",
      avgAnswer: "Media por resposta",
      estimatedPace: "Pace estimado",
      topFillers: "Fillers mais usados",
      fullConversation: "Conversa completa",
      conversationHint: "Veja toda a conversa salva desta avaliacao.",
      examiner: "Examiner",
      student: "Student",
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
    delivery: "Examiner read",
    fillerWords: "Filler words",
    pace: "Pace and speed",
    tonePresence: "Clarity and presence",
    examinerRead: "Examiner final read",
    conversationMetrics: "Conversation metrics",
    answers: "Evidence turns",
    totalWords: "Words",
    avgAnswer: "Avg answer",
    estimatedPace: "Estimated pace",
    topFillers: "Top fillers",
    fullConversation: "Full conversation",
    conversationHint: "Review the full saved conversation from this assessment.",
    examiner: "Examiner",
    student: "Student",
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
    select: {
      id: true,
      createdAt: true,
      displayLevel: true,
      cefrLevel: true,
      score: true,
      summary: true,
      strengths: true,
      focusAreas: true,
      fluencyScore: true,
      pronunciationScore: true,
      grammarScore: true,
      vocabularyScore: true,
      comprehensionScore: true,
      durationSeconds: true,
      transcript: true,
    },
  });

  if (!result) redirect("/hub/test/realtime");

  const componentScores = [
    ["Fluency", result.fluencyScore ?? 0],
    ["Pronunciation", result.pronunciationScore ?? 0],
    ["Grammar", result.grammarScore ?? 0],
    ["Vocabulary", result.vocabularyScore ?? 0],
    ["Comprehension", result.comprehensionScore ?? 0],
  ];
  const transcript = normalizeRealtimeEnglishTranscript(result.transcript);
  const artifacts = buildRealtimeEnglishReportArtifacts({
    language: lang,
    transcript,
    durationSeconds: result.durationSeconds ?? null,
    result: {
      cefrLevel: result.cefrLevel ?? "B1",
      score: result.score ?? 0,
      fluencyScore: result.fluencyScore ?? 0,
      pronunciationScore: result.pronunciationScore ?? 0,
      grammarScore: result.grammarScore ?? 0,
      vocabularyScore: result.vocabularyScore ?? 0,
      comprehensionScore: result.comprehensionScore ?? 0,
    },
  });

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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">{copy.delivery}</h2>
          <div className="space-y-3 text-sm leading-6 text-gray-600">
            <div>
              <p className="font-semibold text-gray-900">{copy.fillerWords}</p>
              <p className="mt-1">{artifacts.deliveryAnalysis.fillerWordAssessment}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{copy.pace}</p>
              <p className="mt-1">{artifacts.deliveryAnalysis.paceAssessment}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{copy.tonePresence}</p>
              <p className="mt-1">{artifacts.deliveryAnalysis.toneAndPresence}</p>
            </div>
            <div>
              <p className="font-semibold text-gray-900">{copy.examinerRead}</p>
              <p className="mt-1">{artifacts.deliveryAnalysis.examinerRead}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-bold text-gray-900 mb-3">{copy.conversationMetrics}</h2>
          <div className="space-y-2.5">
            {[
              [copy.answers, String(artifacts.conversationMetrics.studentTurns)],
              [copy.totalWords, String(artifacts.conversationMetrics.totalStudentWords)],
              [copy.avgAnswer, String(artifacts.conversationMetrics.avgWordsPerAnswer)],
              [copy.estimatedPace, `${artifacts.conversationMetrics.estimatedWordsPerMinute} wpm`],
              [copy.fillerWords, String(artifacts.conversationMetrics.fillerWordCount)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                <span className="text-gray-500">{label}</span>
                <span className="font-semibold text-gray-900">{value}</span>
              </div>
            ))}
          </div>

          {artifacts.conversationMetrics.topFillerWords.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-2">{copy.topFillers}</p>
              <div className="flex flex-wrap gap-2">
                {artifacts.conversationMetrics.topFillerWords.map((item) => (
                  <span key={item} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {transcript.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="text-xs font-bold uppercase tracking-wide text-gray-500">{copy.fullConversation}</h2>
            <p className="mt-1 text-sm text-gray-500">{copy.conversationHint}</p>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto p-4">
            {transcript.map((item, index) => (
              <div
                key={`${item.at}-${index}`}
                className={`flex ${item.role === "student" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                    item.role === "student"
                      ? "rounded-br-sm text-white"
                      : "rounded-bl-sm border-l-2 bg-gray-50 text-gray-700"
                  }`}
                  style={
                    item.role === "student"
                      ? { backgroundColor: BRAND_COLORS.VERDE }
                      : { borderLeftColor: BRAND_COLORS.VERDE }
                  }
                >
                  <p className={`mb-1 text-[10px] font-bold uppercase tracking-wide ${item.role === "student" ? "text-white/40" : "text-gray-400"}`}>
                    {item.role === "student" ? copy.student : copy.examiner}
                  </p>
                  {item.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
