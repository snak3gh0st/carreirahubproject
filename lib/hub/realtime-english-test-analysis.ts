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
          ? "O ritmo pareceu mais travado ou cauteloso. A fala pede mais continuidade para soar mais natural em uma conversa em ingles."
        : wpm <= 155
            ? "O ritmo ficou em uma faixa boa para uma avaliacao oral: claro, controlado e relativamente facil de acompanhar."
            : wpm <= 185
              ? "O ritmo esta funcional, mas em alguns momentos pode ter ficado rapido demais. Vale desacelerar levemente nas partes mais importantes."
              : "O ritmo estimado ficou acelerado para uma conversa guiada. Reduzir a velocidade deve melhorar clareza, presenca e compreensao.";

    const toneAndPresence =
      overallBand === "high" && fluencyBand !== "low"
        ? "A combinacao de fluencia, compreensao e consistencia sugere boa presenca para uma conversa em ingles."
        : overallBand === "mid"
          ? "A presenca geral ja sustenta uma conversa guiada em ingles, mas ainda alterna entre momentos convincentes e trechos menos firmes."
          : "A presenca ainda parece instavel para uma conversa em ingles mais longa. Falta mais controle de resposta, clareza e seguranca.";

    const examinerRead =
      result.score >= 85
        ? `Leitura final: comunicacao oral em ingles forte para o nivel ${result.cefrLevel}, com boa fluencia e clareza em conversa guiada.`
        : result.score >= 70
          ? `Leitura final: comunicacao oral funcional no nivel ${result.cefrLevel}, com boa base para conversa em ingles e pontos claros de refinamento.`
          : result.score >= 55
            ? `Leitura final: base oral em ingles no nivel ${result.cefrLevel}, porem ainda irregular para manter conversa com seguranca sem treino focado.`
            : `Leitura final: o nivel oral atual ${result.cefrLevel} ainda exige mais pratica guiada antes de conversas em ingles com maior autonomia.`;

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
        ? "The pace reads as cautious or hesitant. The answer flow needs more continuity to sound natural in an English conversation."
        : wpm <= 155
          ? "The pace stayed in a strong oral assessment range: clear, controlled, and fairly easy to follow."
          : wpm <= 185
            ? "The pace is workable, but some moments may have sounded slightly rushed. Slowing down on key points would help."
            : "The estimated pace is fast for a guided conversation. Slowing down should improve clarity, presence, and comprehension.";

  const toneAndPresence =
    overallBand === "high" && fluencyBand !== "low"
      ? "The combination of fluency, comprehension, and consistency suggests strong presence in an English conversation."
      : overallBand === "mid"
        ? "Overall presence can sustain a guided English conversation, but it still moves between confident moments and less controlled stretches."
        : "Presence still reads as unstable for a longer English conversation. The student needs more control, clarity, and confidence in spoken English.";

  const examinerRead =
    result.score >= 85
      ? `Final read: the student shows strong oral English communication at ${result.cefrLevel} level with clear fluency in guided conversation.`
      : result.score >= 70
        ? `Final read: the student has functional oral English at ${result.cefrLevel} level, with a solid base for conversation and clear areas to refine.`
        : result.score >= 55
          ? `Final read: the student has a workable oral English base at ${result.cefrLevel} level, but needs focused practice for more consistent conversation.`
          : `Final read: the current ${result.cefrLevel} oral level still needs more guided practice before independent English conversations feel stable.`;

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
