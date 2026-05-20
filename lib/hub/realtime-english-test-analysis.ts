import type { Language } from "@/lib/i18n/hub";
import type { RealtimeEnglishTranscriptLike } from "@/lib/hub/realtime-english-test-flow";

export interface RealtimeEnglishConversationMetrics {
  studentTurns: number;
  totalStudentWords: number;
  avgWordsPerAnswer: number;
  estimatedWordsPerMinute: number;
  fillerWordCount: number;
  topFillerWords: string[];
}

export interface RealtimeEnglishDeliveryAnalysis {
  fillerWordAssessment: string;
  paceAssessment: string;
  toneAndPresence: string;
  examinerRead: string;
}

export interface RealtimeEnglishReportArtifacts {
  conversationMetrics: RealtimeEnglishConversationMetrics;
  deliveryAnalysis: RealtimeEnglishDeliveryAnalysis;
}

interface RealtimeEnglishScoredRead {
  cefrLevel: string;
  score: number;
  fluencyScore: number;
  pronunciationScore: number;
  grammarScore: number;
  vocabularyScore: number;
  comprehensionScore: number;
}

const FILLER_PATTERNS = [
  "um",
  "uh",
  "like",
  "you know",
  "i mean",
  "sort of",
  "kind of",
  "actually",
  "basically",
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function sortedTopEntries(counter: Map<string, number>): string[] {
  return [...counter.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([label, count]) => `${label} (${count})`);
}

function scoreBand(value: number): "low" | "mid" | "high" {
  if (value >= 8) return "high";
  if (value >= 6) return "mid";
  return "low";
}

export function buildRealtimeEnglishConversationMetrics(input: {
  transcript: RealtimeEnglishTranscriptLike[];
  durationSeconds?: number | null;
}): RealtimeEnglishConversationMetrics {
  const studentTurns = input.transcript.filter((item) => item.role === "student" && item.text.trim());
  const fillerCounter = new Map<string, number>();
  let totalStudentWords = 0;

  for (const item of studentTurns) {
    totalStudentWords += countWords(item.text);
    const normalized = item.text.toLowerCase();

    for (const filler of FILLER_PATTERNS) {
      const matches = normalized.match(new RegExp(`\\b${filler.replace(/\s+/g, "\\s+")}\\b`, "g"));
      if (!matches?.length) continue;
      fillerCounter.set(filler, (fillerCounter.get(filler) ?? 0) + matches.length);
    }
  }

  const durationMinutes =
    typeof input.durationSeconds === "number" && Number.isFinite(input.durationSeconds) && input.durationSeconds > 0
      ? input.durationSeconds / 60
      : 0;
  const fillerWordCount = [...fillerCounter.values()].reduce((sum, value) => sum + value, 0);

  return {
    studentTurns: studentTurns.length,
    totalStudentWords,
    avgWordsPerAnswer: studentTurns.length > 0 ? Math.round(totalStudentWords / studentTurns.length) : 0,
    estimatedWordsPerMinute:
      durationMinutes > 0 ? Math.round(totalStudentWords / durationMinutes) : 0,
    fillerWordCount,
    topFillerWords: sortedTopEntries(fillerCounter),
  };
}

export function buildRealtimeEnglishDeliveryAnalysis(input: {
  language: Language;
  result: RealtimeEnglishScoredRead;
  conversationMetrics: RealtimeEnglishConversationMetrics;
}): RealtimeEnglishDeliveryAnalysis {
  const { language, result, conversationMetrics } = input;
  const fillerDensity =
    conversationMetrics.totalStudentWords > 0
      ? (conversationMetrics.fillerWordCount / conversationMetrics.totalStudentWords) * 100
      : 0;
  const avgCore =
    (result.fluencyScore +
      result.pronunciationScore +
      result.grammarScore +
      result.vocabularyScore +
      result.comprehensionScore) /
    5;
  const fluencyBand = scoreBand(result.fluencyScore);
  const overallBand = scoreBand(avgCore);
  const wpm = conversationMetrics.estimatedWordsPerMinute;

  if (language === "pt-BR") {
    const fillerWordAssessment =
      conversationMetrics.fillerWordCount === 0
        ? "Quase nao apareceram filler words no transcript, o que passa uma fala mais limpa e segura."
        : fillerDensity <= 1.5
          ? "Os fillers apareceram, mas ainda em nivel controlado. Nao comprometem a mensagem, porem vale limpar mais a transicao entre ideias."
          : fillerDensity <= 3.5
            ? "Existe uso perceptivel de fillers sob pressao. A mensagem continua entendivel, mas a entrega perde firmeza em alguns momentos."
            : "Os fillers aparecem com frequencia suficiente para enfraquecer clareza e presenca. Vale treinar pausas curtas no lugar de preencher o silencio.";

    const paceAssessment =
      wpm === 0
        ? "O ritmo estimado nao pode ser calculado com seguranca nesta sessao."
        : wpm < 80
          ? "O ritmo pareceu mais travado ou cauteloso. A fala pede mais continuidade para soar mais natural em contexto corporativo."
          : wpm <= 155
            ? "O ritmo ficou em uma faixa boa para entrevistas: claro, controlado e relativamente facil de acompanhar."
            : wpm <= 185
              ? "O ritmo esta funcional, mas em alguns momentos pode ter ficado rapido demais. Vale desacelerar levemente nas partes mais importantes."
              : "O ritmo estimado ficou acelerado para entrevista. Reduzir a velocidade deve melhorar clareza, presenca e compreensao.";

    const toneAndPresence =
      overallBand === "high" && fluencyBand !== "low"
        ? "A combinacao de fluencia, compreensao e consistencia sugere boa presenca para uma entrevista profissional em ingles."
        : overallBand === "mid"
          ? "A presenca geral ja sustenta conversa profissional, mas ainda alterna entre momentos convincentes e trechos menos firmes."
          : "A presenca ainda parece instavel para um contexto seletivo mais exigente. Falta mais controle de resposta, clareza e seguranca em ingles.";

    const examinerRead =
      result.score >= 85
        ? `Leitura final: candidato com ingles convincente para entrevista corporativa em nivel ${result.cefrLevel}, com sinais de prontidao real para processos mais seletivos.`
        : result.score >= 70
          ? `Leitura final: candidato competitivo para entrevistas em ingles no nivel ${result.cefrLevel}, mas ainda com pontos de ajuste para soar mais senior e natural.`
          : result.score >= 55
            ? `Leitura final: base funcional em ingles no nivel ${result.cefrLevel}, porem ainda nao consistente o suficiente para entrevistas mais exigentes sem treino focado.`
            : `Leitura final: o nivel atual ${result.cefrLevel} ainda exige mais preparacao antes de uma entrevista corporativa em ingles com maior pressao.`;

    return {
      fillerWordAssessment,
      paceAssessment,
      toneAndPresence,
      examinerRead,
    };
  }

  const fillerWordAssessment =
    conversationMetrics.fillerWordCount === 0
      ? "Almost no filler words appeared in the transcript, which supports a cleaner and more confident delivery."
      : fillerDensity <= 1.5
        ? "Filler words appeared, but still in a controlled range. They do not block the message, though cleaner transitions would help."
        : fillerDensity <= 3.5
          ? "There is noticeable filler usage under pressure. The message remains understandable, but the delivery loses some authority."
          : "Filler usage is frequent enough to weaken clarity and executive presence. Short pauses would be stronger than filling silence.";

  const paceAssessment =
    wpm === 0
      ? "Estimated pace could not be measured reliably in this session."
      : wpm < 80
        ? "The pace reads as cautious or hesitant. The answer flow needs more continuity to sound natural in a corporate interview."
        : wpm <= 155
          ? "The pace stayed in a strong interview range: clear, controlled, and fairly easy to follow."
          : wpm <= 185
            ? "The pace is workable, but some moments may have sounded slightly rushed. Slowing down on key points would help."
            : "The estimated pace is fast for an interview setting. Slowing down should improve clarity, presence, and comprehension.";

  const toneAndPresence =
    overallBand === "high" && fluencyBand !== "low"
      ? "The combination of fluency, comprehension, and consistency suggests strong presence for a professional English interview."
      : overallBand === "mid"
        ? "Overall presence can sustain a professional conversation, but it still moves between convincing moments and less controlled stretches."
        : "Presence still reads as unstable for a selective interview. The student needs more control, clarity, and confidence in spoken English.";

  const examinerRead =
    result.score >= 85
      ? `Final read: the candidate sounds credible for a corporate English interview at ${result.cefrLevel} level and shows real readiness for more selective processes.`
      : result.score >= 70
        ? `Final read: the candidate is competitive for English interviews at ${result.cefrLevel} level, but still needs refinement to sound more senior and natural.`
        : result.score >= 55
          ? `Final read: the candidate has workable English at ${result.cefrLevel} level, but not yet enough consistency for demanding interviews without focused practice.`
          : `Final read: the current ${result.cefrLevel} level still needs more preparation before a higher-pressure corporate English interview.`;

  return {
    fillerWordAssessment,
    paceAssessment,
    toneAndPresence,
    examinerRead,
  };
}

export function buildRealtimeEnglishReportArtifacts(input: {
  language: Language;
  transcript: RealtimeEnglishTranscriptLike[];
  durationSeconds?: number | null;
  result: RealtimeEnglishScoredRead;
}): RealtimeEnglishReportArtifacts {
  const conversationMetrics = buildRealtimeEnglishConversationMetrics({
    transcript: input.transcript,
    durationSeconds: input.durationSeconds,
  });

  return {
    conversationMetrics,
    deliveryAnalysis: buildRealtimeEnglishDeliveryAnalysis({
      language: input.language,
      result: input.result,
      conversationMetrics,
    }),
  };
}
