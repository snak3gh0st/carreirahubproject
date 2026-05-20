"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  FileText,
  Headphones,
  Loader2,
  Lock,
  Mic,
  MicOff,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";
import {
  REALTIME_ENGLISH_TEST_DURATION_LABEL,
  REALTIME_ENGLISH_TEST_MAX_TRANSCRIPT_ITEMS,
  REALTIME_ENGLISH_TEST_STAGES,
  buildEvaluatorUnavailableRealtimeTurnEvaluation,
  getCurrentRealtimeEnglishTestStage,
  getRealtimeEnglishTestProgress,
  isMeaningfulRealtimeStudentTranscript,
  normalizeRealtimeEnglishTurnEvaluation,
  type RealtimeEnglishTurnEvaluation,
} from "@/lib/hub/realtime-english-test-flow";
import { buildRealtimeEnglishReportArtifacts } from "@/lib/hub/realtime-english-test-analysis";
import {
  getMicrophoneAccessErrorMessage,
  getRealtimeSessionErrorMessage,
} from "@/lib/hub/realtime-browser-errors";
import {
  REALTIME_TURN_RESUME_GRACE_MS,
  RealtimeTurnAccumulator,
} from "@/lib/hub/realtime-turn-accumulator";

const REALTIME_ENGLISH_TEST_COMPLETION_PHRASE =
  "English assessment complete. I have enough evidence to prepare your result now.";

type SessionStatus = "idle" | "connecting" | "live" | "scoring" | "complete" | "error";
type RealtimeResponseRequest = Record<string, unknown>;

interface TranscriptItem {
  role: "student" | "examiner";
  text: string;
  at: string;
  acceptedEvidence?: boolean;
  stageId?: string | null;
  issueType?: string | null;
  evaluationReason?: string | null;
}

interface VoiceResult {
  cefrLevel: string;
  displayLevel: string;
  score: number;
  fluencyScore: number;
  pronunciationScore: number;
  grammarScore: number;
  vocabularyScore: number;
  comprehensionScore: number;
  summary: string;
  strengths: string[];
  focusAreas: string[];
  deliveryAnalysis?: {
    fillerWordAssessment: string;
    paceAssessment: string;
    toneAndPresence: string;
    examinerRead: string;
  };
  conversationMetrics?: {
    studentTurns: number;
    totalStudentWords: number;
    avgWordsPerAnswer: number;
    estimatedWordsPerMinute: number;
    fillerWordCount: number;
    topFillerWords: string[];
  };
}

interface OralAccess {
  unlocked: boolean;
  message?: string | null;
  writtenTest?: {
    cefrLevel: string;
    displayLevel: string;
    percentage: number;
  } | null;
}

class RealtimeSessionStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealtimeSessionStartError";
  }
}

async function readRealtimeSessionError(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json();
    if (typeof body?.error === "string") return body.error;
  } catch {
    // Response may be plain text or SDP.
  }

  try {
    const text = await response.text();
    return text.trim().slice(0, 300) || undefined;
  } catch {
    return undefined;
  }
}

function getLangFromCookie(): Language {
  try {
    const match = document.cookie.match(/(?:^|;\s*)hub-token=([^;]*)/);
    if (!match?.[1]) return "en";
    const [, b64] = match[1].split(".");
    if (!b64) return "en";
    const payload = JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    return (payload?.language || "en") as Language;
  } catch {
    return "en";
  }
}

function copyFor(lang: Language) {
  if (lang === "pt-BR") {
    return {
      title: "Teste de inglês ao vivo",
      eyebrow: "English Speaking Test",
      subtitle: "Simulação oral premium com avaliador AI, áudio em tempo real e leitura final no padrão de entrevista corporativa.",
      start: "Iniciar teste",
      stop: "Parar",
      connecting: "Conectando áudio...",
      live: "Teste ao vivo",
      finish: "Finalizar e gerar resultado",
      mute: "Mutar microfone",
      unmute: "Ativar microfone",
      scoring: "Gerando resultado...",
      fallback: "Fazer teste escrito",
      result: "Resultado da avaliação oral",
      back: "Voltar ao painel",
      retry: "Tentar novamente",
      microphoneError: "Nao foi possivel acessar o microfone.",
      connectionError: "Nao foi possivel iniciar o teste por voz.",
      scoreError: "Nao foi possivel gerar o resultado. Tente finalizar novamente em alguns segundos.",
      answerBeforeFinish: "Responda pelo menos uma pergunta antes de finalizar.",
      evaluatingAnswer: "Validando resposta...",
      evaluatingFinishWait: "Aguarde um momento enquanto a resposta atual é validada.",
      incompleteTest: "A prova ainda nao tem evidencias suficientes para gerar resultado. Complete as etapas restantes. Se precisar encerrar agora, solicite ao operacional um reset ou uma nova prova.",
      saved: "Resultado salvo.",
      transcript: "Transcrição",
      fullConversation: "Conversa completa",
      conversationHint: "Veja toda a conversa capturada entre voce e o avaliador AI.",
      strengths: "Pontos fortes",
      focusAreas: "Focar agora",
      signal: "Conexão de voz",
      listening: "Ouvindo",
      readyCopy: "Pronto para iniciar",
      privacy: "Uso interno para avaliação",
      bestExperience: "Para melhor experiência e análise, faça o teste sozinho e de fone.",
      liveHint: "Respire, organize a ideia em inglês e responda com calma. O avaliador vai conduzir o resto.",
      resultHint: "Pontuação salva no seu perfil CarreiraHub.",
      controlPanel: "Brief da avaliação",
      aiTeacher: "Avaliador Carreira USA",
      interviewer: "Brief da avaliacao",
      candidate: "Aluno",
      microphone: "Microfone",
      session: "Sessão",
      model: "Modelo",
      mode: "Modo",
      language: "Idioma",
      assessment: "Avaliação",
      duration: "Tempo",
      durationValue: "8 a 10 min",
      sections: "Etapas da prova",
      sectionsComplete: "concluidas",
      resumeNotice: "Progresso recuperado. A prova continua do ponto salvo.",
      ready: "Pronto",
      active: "Ativa",
      offline: "Aguardando",
      liveAudio: "Áudio ao vivo",
      englishOnly: "English only",
      cefrReady: "CEFR",
      roomIdle: "Sala pronta",
      roomConnecting: "Abrindo canal seguro",
      roomLive: "Entrevista em andamento",
      roomScoring: "Calculando resultado",
      roomComplete: "Resultado gerado",
      roomError: "Sessão interrompida",
      roomEvaluating: "Validando etapa",
      examinerLabel: "Examiner",
      studentLabel: "Student",
      transcriptEmptyTitle: "Aguardando áudio",
      aiControlsFinish: "A AI conduz a avaliacao e encerra so quando houver evidencia suficiente.",
      confidenceTitle: "Como essa avaliacao funciona",
      confidenceBullets: [
        "O avaliador conduz como um entrevistador humano: claro, calmo e profissional.",
        "Voce pode pedir para repetir ou simplificar a pergunta se necessario.",
        "O foco nao e apenas gramatica: tambem conta clareza, confianca e comunicacao profissional.",
      ],
      coachTitle: "O que soa forte em ingles",
      coachBullets: [
        "Comece pela resposta principal e depois sustente com exemplo.",
        "Use pausas curtas em vez de preencher silencio com um, uh, like ou i mean.",
        "Priorize frases claras e objetivas, em vez de tentar parecer rebuscado.",
      ],
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
      briefSummary: "A sessao mistura perguntas de carreira, role-play, cenarios de trabalho e reasoning para medir quao natural e convincente seu ingles profissional realmente soa.",
      writtenRequiredTitle: "Teste escrito primeiro",
      writtenRequiredMessage: "Complete o teste escrito de ingles antes de iniciar a entrevista oral.",
      writtenRequiredCta: "Ir para o teste escrito",
    };
  }

  return {
    title: "Live English test",
    eyebrow: "English speaking test",
    subtitle: "Premium live speaking assessment with a human-style AI examiner and a final CEFR read built for corporate English.",
    start: "Start test",
    stop: "Stop",
    connecting: "Connecting audio...",
    live: "Live test",
    finish: "Finish and score",
    mute: "Mute microphone",
    unmute: "Unmute microphone",
    scoring: "Preparing result...",
    fallback: "Take written test",
    result: "Speaking assessment result",
    back: "Back to dashboard",
    retry: "Try again",
    microphoneError: "Could not access the microphone.",
    connectionError: "Could not start the voice test.",
    scoreError: "Could not prepare the score. Try finishing again in a few seconds.",
    answerBeforeFinish: "Answer at least one question before finishing.",
    evaluatingAnswer: "Evaluating answer...",
    evaluatingFinishWait: "Wait a moment while the current answer is evaluated.",
    incompleteTest: "The test does not have enough evidence to generate a result yet. Complete the remaining sections. If you need to stop now, contact operations for a reset or new test.",
    saved: "Result saved.",
    transcript: "Transcript",
    fullConversation: "Full conversation",
    conversationHint: "Review the complete conversation captured between you and the AI examiner.",
    strengths: "Strengths",
    focusAreas: "Focus areas",
    signal: "Voice connection",
    listening: "Listening",
    readyCopy: "Speak when ready",
    privacy: "Internal assessment use",
    bestExperience: "For the best experience and analysis, take the test alone and with headphones.",
    liveHint: "Take a breath, organize the idea, and answer clearly. The examiner will guide the rest.",
    resultHint: "Score saved to your CarreiraHub profile.",
    controlPanel: "Assessment brief",
    aiTeacher: "Carreira USA examiner",
    interviewer: "Assessment brief",
    candidate: "Student",
    microphone: "Microphone",
    session: "Session",
    model: "Model",
    mode: "Mode",
    language: "Language",
    assessment: "Assessment",
    duration: "Time",
    durationValue: "8 to 10 min",
    sections: "Test sections",
    sectionsComplete: "complete",
    resumeNotice: "Progress restored. The test will continue from the saved point.",
    ready: "Ready",
    active: "Active",
    offline: "Waiting",
    liveAudio: "Live audio",
    englishOnly: "English only",
    cefrReady: "CEFR",
    roomIdle: "Room ready",
    roomConnecting: "Opening secure channel",
    roomLive: "Test in progress",
    roomScoring: "Preparing score",
    roomComplete: "Result generated",
    roomError: "Session interrupted",
    roomEvaluating: "Evaluating section",
    examinerLabel: "Examiner",
    studentLabel: "Student",
    transcriptEmptyTitle: "Waiting for audio",
    aiControlsFinish: "The AI leads the assessment and ends it only when there is enough evidence.",
    confidenceTitle: "How this assessment works",
    confidenceBullets: [
      "The examiner should feel like a human interviewer: calm, clear, and professional.",
      "You can ask for the question to be repeated or simplified if needed.",
      "This is not only about grammar. Clarity, confidence, and workplace communication also matter.",
    ],
    coachTitle: "What sounds strong in English",
    coachBullets: [
      "Lead with the answer, then support it with a concrete example.",
      "Use short pauses instead of filling silence with um, uh, like, or i mean.",
      "Aim for clear and direct sentences instead of overcomplicating the wording.",
    ],
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
    briefSummary: "The session mixes career questions, role-play, business scenarios, and reasoning prompts to measure how natural and convincing your professional English really sounds.",
    writtenRequiredTitle: "Written test first",
    writtenRequiredMessage: "Complete the written English test before starting the oral interview.",
    writtenRequiredCta: "Go to written test",
  };
}

function openingPrompt(transcriptItems: TranscriptItem[]) {
  const progress = getRealtimeEnglishTestProgress(transcriptItems);

  if (progress.studentTurns > 0) {
    return [
      "Resume the existing Carreira USA English speaking assessment now.",
      "Do not repeat the full opening and do not ask the student to repeat information already captured.",
      "Sound like a polished human examiner: warm, calm, and direct.",
      `Briefly welcome the student back and say the test usually takes about ${REALTIME_ENGLISH_TEST_DURATION_LABEL}.`,
      `Tell the student they have completed ${progress.completedStageCount} of ${progress.requiredStudentTurns} required sections and that you still need the remaining sections for a reliable CEFR result.`,
      "Do not tell the student the exact internal completion phrase.",
      "Use the saved conversation context and either ask the next best assessment question in English or close the assessment if you already have enough evidence.",
      "Choose a different format from what was already covered when possible: workplace role-play, business scenario, behavioral evidence, opinion reasoning, or clarification follow-up.",
      "If useful, remind the student they can ask you to repeat or clarify the question.",
      "Ask exactly one question.",
    ].join(" ");
  }

  return [
    "Start the live Carreira USA English speaking assessment now.",
    "Briefly introduce yourself as the Carreira USA English examiner inside CarreiraHub.",
    "Sound reassuring, polished, and human, like a strong interviewer from a top company.",
    "Explain in English that Carreira USA helps professionals prepare for U.S. corporate opportunities and that this live assessment measures professional English communication, fluency, pronunciation, grammar, vocabulary, comprehension, confidence, and CEFR readiness.",
    `Tell the student the full assessment usually takes about ${REALTIME_ENGLISH_TEST_DURATION_LABEL} and moves through five short sections.`,
    "Explain that you will guide the full conversation and prepare the result only after you have enough evidence.",
    "Tell the student they can ask you to repeat or clarify a question if needed.",
    "Tell the student that the interview will use different formats, including professional interview questions, workplace scenarios, role-play, opinion questions, and follow-ups based on their answers.",
    "Keep the introduction under 30 seconds.",
    "Do not start with only 'What is your name?'",
    "Then ask one substantial first question about the student's current role, professional background, or career goal in the United States.",
    "After the student answers, choose a targeted follow-up before moving on if the answer is short, vague, memorized, unclear, or interesting enough to probe deeper.",
  ].join(" ");
}

function isRealtimeEnglishCompletionCue(text: string) {
  return text.toLowerCase().includes(REALTIME_ENGLISH_TEST_COMPLETION_PHRASE.toLowerCase());
}

function isActiveResponseConflict(message: string) {
  return /active response|response is finished|response in progress/i.test(message);
}

export default function RealtimeEnglishTestPage() {
  const [lang, setLang] = useState<Language>("en");
  const copy = useMemo(() => copyFor(lang), [lang]);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [evaluatingTurn, setEvaluatingTurn] = useState(false);
  const [oralAccess, setOralAccess] = useState<OralAccess | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const testIdRef = useRef<string | null>(null);
  const statusRef = useRef<SessionStatus>("idle");
  const startTimeRef = useRef<number>(0);
  const restoredDurationSecondsRef = useRef(0);
  const responseInProgressRef = useRef(false);
  const responseWatchdogRef = useRef<number | null>(null);
  const evaluatingStudentTurnRef = useRef(false);
  const queuedStudentTranscriptRef = useRef<string | null>(null);
  const recordedUsageResponseIdsRef = useRef<Set<string>>(new Set());
  const pendingExaminerResponseRef = useRef<RealtimeResponseRequest | null>(null);
  const lastRequestedExaminerResponseRef = useRef<RealtimeResponseRequest | null>(null);
  const autoFinishingRef = useRef(false);
  const studentTurnAccumulatorRef = useRef<RealtimeTurnAccumulator | null>(null);
  const handleStudentTurnFinalizedRef = useRef<(text: string) => void>(() => undefined);

  useEffect(() => {
    setLang(getLangFromCookie());
    void loadSavedProgress();
    return () => cleanupRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status !== "live" && status !== "scoring") return undefined;
    const timer = window.setInterval(() => {
      const activeSeconds = startTimeRef.current
        ? Math.round((Date.now() - startTimeRef.current) / 1000)
        : 0;
      setElapsedSeconds(restoredDurationSecondsRef.current + activeSeconds);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    studentTurnAccumulatorRef.current = new RealtimeTurnAccumulator({
      graceMs: REALTIME_TURN_RESUME_GRACE_MS,
      onFinalized: (text) => handleStudentTurnFinalizedRef.current(text),
    });

    return () => studentTurnAccumulatorRef.current?.reset();
  }, []);

  function setActiveTestId(nextTestId: string | null) {
    testIdRef.current = nextTestId;
    setTestId(nextTestId);
  }

  async function loadSavedProgress(): Promise<OralAccess | null> {
    try {
      const response = await fetch("/api/hub/test/realtime/progress", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return null;

      const data = await response.json();
      const nextOralAccess = data?.oralAccess && typeof data.oralAccess === "object"
        ? data.oralAccess as OralAccess
        : null;
      setOralAccess(nextOralAccess);

      const savedTranscript = Array.isArray(data?.transcript)
        ? data.transcript.filter((item: any): item is TranscriptItem =>
            item &&
            (item.role === "student" || item.role === "examiner") &&
            typeof item.text === "string" &&
            typeof item.at === "string"
          )
        : [];

      if (typeof data?.testId === "string" && data.testId) {
        setActiveTestId(data.testId);
      } else {
        setActiveTestId(null);
      }

      if (savedTranscript.length > 0) {
        transcriptRef.current = savedTranscript;
        setTranscript(savedTranscript);
      }

      const savedDurationSeconds =
        typeof data?.durationSeconds === "number" && Number.isFinite(data.durationSeconds)
          ? Math.max(0, data.durationSeconds)
          : 0;
      restoredDurationSecondsRef.current = savedDurationSeconds;
      setElapsedSeconds(savedDurationSeconds);
      return nextOralAccess;
    } catch {
      // Progress restore is best-effort; the live session can still start.
      return null;
    }
  }

  async function persistProgress(nextTranscript: TranscriptItem[]) {
    const activeTestId = testIdRef.current;
    if (!activeTestId || status === "complete") return;

    try {
      await fetch("/api/hub/test/realtime/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: activeTestId,
          transcript: nextTranscript,
          durationSeconds: getDurationSeconds(),
        }),
      });
    } catch {
      // The next completed turn will try again; do not interrupt the test UX.
    }
  }

  function addTranscript(
    role: TranscriptItem["role"],
    text: string,
    metadata: Partial<TranscriptItem> = {}
  ) {
    const clean = text.trim();
    if (!clean) return [];

    const nextItem: TranscriptItem = {
      ...metadata,
      role,
      text: clean,
      at: new Date().toISOString(),
    };
    const nextItems: TranscriptItem[] = [
      ...transcriptRef.current.slice(-(REALTIME_ENGLISH_TEST_MAX_TRANSCRIPT_ITEMS - 1)),
      nextItem,
    ];
    transcriptRef.current = nextItems;
    setTranscript(nextItems);
    void persistProgress(nextItems);
    return nextItems;
  }

  function getDurationSeconds() {
    const activeSeconds = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;
    return restoredDurationSecondsRef.current + activeSeconds;
  }

  function cleanupRealtime() {
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    markResponseIdle();
    evaluatingStudentTurnRef.current = false;
    queuedStudentTranscriptRef.current = null;
    pendingExaminerResponseRef.current = null;
    lastRequestedExaminerResponseRef.current = null;
    studentTurnAccumulatorRef.current?.reset();
  }

  function sendRealtimeEvent(payload: Record<string, unknown>) {
    if (!dcRef.current || dcRef.current.readyState !== "open") return false;
    dcRef.current.send(JSON.stringify(payload));
    return true;
  }

  function clearResponseWatchdog() {
    if (responseWatchdogRef.current) {
      window.clearTimeout(responseWatchdogRef.current);
      responseWatchdogRef.current = null;
    }
  }

  function markResponseInProgress() {
    responseInProgressRef.current = true;
    clearResponseWatchdog();
    responseWatchdogRef.current = window.setTimeout(() => {
      if (!responseInProgressRef.current) return;
      responseInProgressRef.current = false;
      lastRequestedExaminerResponseRef.current = null;
      flushPendingExaminerResponse();
    }, 45000);
  }

  function markResponseIdle() {
    responseInProgressRef.current = false;
    clearResponseWatchdog();
  }

  function createRealtimeResponse(response: RealtimeResponseRequest) {
    lastRequestedExaminerResponseRef.current = response;
    const sent = sendRealtimeEvent({ type: "response.create", response });
    if (sent) markResponseInProgress();
    return sent;
  }

  function cancelActiveResponse() {
    if (!responseInProgressRef.current) return false;
    return sendRealtimeEvent({ type: "response.cancel" });
  }

  function queueOrCreateRealtimeResponse(response: RealtimeResponseRequest) {
    if (statusRef.current !== "live") return;

    if (responseInProgressRef.current) {
      pendingExaminerResponseRef.current = response;
      cancelActiveResponse();
      return;
    }

    pendingExaminerResponseRef.current = null;
    createRealtimeResponse(response);
  }

  function flushPendingExaminerResponse() {
    const pending = pendingExaminerResponseRef.current;
    if (!pending || statusRef.current !== "live") return;
    pendingExaminerResponseRef.current = null;
    createRealtimeResponse(pending);
  }

  function requestNextExaminerTurn(evaluation?: RealtimeEnglishTurnEvaluation) {
    if (statusRef.current !== "live") return;

    const progress = getRealtimeEnglishTestProgress(transcriptRef.current);
    const currentStage = getCurrentRealtimeEnglishTestStage(transcriptRef.current);
    const isComplete = progress.isCompleteEnough;

    const instructions = !evaluation
      ? [
        "Continue the English speaking assessment from the latest substantive student answer.",
        `The student cannot manually finish the assessment. You decide when there is enough evidence and, when ready, say exactly: "${REALTIME_ENGLISH_TEST_COMPLETION_PHRASE}"`,
        "If there is not enough evidence yet, ask exactly one next question in English.",
        "Use a targeted follow-up if the answer was short, vague, unclear, or interesting.",
        "If the latest audio was only noise, a cough, keyboard sound, breathing, or an unclear fragment, ignore it and do not ask what happened.",
      ]
      : evaluation.acceptedEvidence
        ? [
            `The latest student answer is accepted evidence for this section: ${evaluation.stageTitle}.`,
            isComplete
              ? "All required sections now have enough evidence. Decide whether the evidence is already sufficient or whether one final clarification is essential."
              : `Advance to the next section: ${currentStage.title}.`,
            isComplete
              ? `If the evidence is sufficient, say exactly: "${REALTIME_ENGLISH_TEST_COMPLETION_PHRASE}". Otherwise ask exactly one final clarification question.`
              : `Ask exactly one focused question for this section: ${currentStage.promptFocus}.`,
            "Keep the tone professional and concise. Do not overpraise.",
            "Ignore brief noises, coughs, keyboard sounds, breathing, or unclear fragments.",
          ]
        : [
            `The latest student answer is not acceptable evidence for this section: ${evaluation.stageTitle}.`,
            `Reason: ${evaluation.reason}`,
            `Examiner directive: ${evaluation.examinerDirective}`,
            "Do not advance the section.",
            `Re-ask or reframe one question for the same section: ${currentStage.title}.`,
            "If the student was joking, off-topic, evasive, or unfocused, politely ask them to stay focused and take their time.",
            "Keep the response in English, professional, and under 35 seconds.",
            "Ignore brief noises, coughs, keyboard sounds, breathing, or unclear fragments.",
          ];

    queueOrCreateRealtimeResponse({
      output_modalities: ["audio"],
      instructions: instructions.join(" "),
    });
  }

  async function evaluateStudentTurn(studentAnswer: string): Promise<RealtimeEnglishTurnEvaluation> {
    const stage = getCurrentRealtimeEnglishTestStage(transcriptRef.current);
    const unavailable = buildEvaluatorUnavailableRealtimeTurnEvaluation({ studentAnswer, stage });
    const activeTestId = testIdRef.current;
    if (!activeTestId) return unavailable;

    try {
      const response = await fetch("/api/hub/test/realtime/evaluate-turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: activeTestId,
          transcript: transcriptRef.current,
          studentAnswer,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) return unavailable;

      return normalizeRealtimeEnglishTurnEvaluation(data?.evaluation, {
        studentAnswer,
        stage,
      });
    } catch {
      return unavailable;
    }
  }

  async function handleStudentTranscript(text: string) {
    const clean = text.trim();
    if (!isMeaningfulRealtimeStudentTranscript(clean)) return;

    if (evaluatingStudentTurnRef.current) {
      queuedStudentTranscriptRef.current = clean;
      return;
    }

    evaluatingStudentTurnRef.current = true;
    setEvaluatingTurn(true);

    try {
      const evaluation = await evaluateStudentTurn(clean);
      addTranscript("student", clean, {
        acceptedEvidence: evaluation.acceptedEvidence,
        stageId: evaluation.stageId,
        issueType: evaluation.issueType,
        evaluationReason: evaluation.reason,
      });
      requestNextExaminerTurn(evaluation);
    } finally {
      evaluatingStudentTurnRef.current = false;
      setEvaluatingTurn(false);

      const queuedTranscript = queuedStudentTranscriptRef.current;
      queuedStudentTranscriptRef.current = null;
      if (queuedTranscript && queuedTranscript !== clean) {
        void handleStudentTranscript(queuedTranscript);
      }
    }
  }

  handleStudentTurnFinalizedRef.current = (text: string) => {
    if (!isMeaningfulRealtimeStudentTranscript(text)) return;
    void handleStudentTranscript(text);
  };

  async function persistRealtimeUsageEvent(payload: any) {
    const activeTestId = testIdRef.current;
    if (!activeTestId) return;

    const responseId =
      typeof payload?.response?.id === "string"
        ? payload.response.id
        : typeof payload?.event_id === "string"
          ? payload.event_id
          : "";

    if (responseId) {
      if (recordedUsageResponseIdsRef.current.has(responseId)) return;
      recordedUsageResponseIdsRef.current.add(responseId);
    }

    try {
      await fetch("/api/hub/test/realtime/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: activeTestId,
          event: payload,
        }),
      });
    } catch {
      // Usage is internal Sigma cost tracking; never interrupt the student UX.
    }
  }

  function handleRealtimeEvent(event: MessageEvent<string>) {
    let payload: any;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    if (payload.type === "input_audio_buffer.speech_started") {
      studentTurnAccumulatorRef.current?.handleSpeechStarted();
      return;
    }

    if (payload.type === "input_audio_buffer.speech_stopped") {
      studentTurnAccumulatorRef.current?.handleSpeechStopped();
      return;
    }

    if (payload.type === "conversation.item.input_audio_transcription.completed") {
      const text = payload.transcript || "";
      studentTurnAccumulatorRef.current?.pushTranscriptFragment(text);
      return;
    }

    if (payload.type === "response.created") {
      markResponseInProgress();
      return;
    }

    if (payload.type === "response.cancelled" || payload.type === "response.failed") {
      markResponseIdle();
      lastRequestedExaminerResponseRef.current = null;
      flushPendingExaminerResponse();
      return;
    }

    if (payload.type === "error") {
      const message = payload?.error?.message || copy.connectionError;
      if (isActiveResponseConflict(message)) {
        if (lastRequestedExaminerResponseRef.current) {
          pendingExaminerResponseRef.current = lastRequestedExaminerResponseRef.current;
        }
        markResponseInProgress();
        return;
      }
      setStatus("error");
      setError(message);
      cleanupRealtime();
      return;
    }

    if (payload.type === "response.output_audio_transcript.done") {
      const text = payload.transcript || payload.text || payload.delta || "";
      addTranscript("examiner", text);
      if (isRealtimeEnglishCompletionCue(text)) {
        autoFinishingRef.current = true;
      }
      return;
    }

    if (payload.type === "response.done") {
      void persistRealtimeUsageEvent(payload);
      markResponseIdle();
      lastRequestedExaminerResponseRef.current = null;
      if (autoFinishingRef.current) {
        autoFinishingRef.current = false;
        void finishSession();
        return;
      }
      flushPendingExaminerResponse();
    }
  }

  async function startSession() {
    setError(null);
    setResult(null);
    const latestAccess = await loadSavedProgress();
    if (latestAccess?.unlocked === false) {
      setStatus("idle");
      statusRef.current = "idle";
      setError(latestAccess.message || copy.writtenRequiredMessage);
      return;
    }
    const resumeTranscript = transcriptRef.current;
    const shouldResume = Boolean(testIdRef.current && resumeTranscript.length > 0);
    if (!shouldResume) {
      setTranscript([]);
      transcriptRef.current = [];
      restoredDurationSecondsRef.current = 0;
      setElapsedSeconds(0);
    } else {
      setElapsedSeconds(restoredDurationSecondsRef.current);
    }
    statusRef.current = "connecting";
    setStatus("connecting");
    markResponseIdle();
    evaluatingStudentTurnRef.current = false;
    queuedStudentTranscriptRef.current = null;
    setEvaluatingTurn(false);
    pendingExaminerResponseRef.current = null;
    lastRequestedExaminerResponseRef.current = null;
    autoFinishingRef.current = false;
    studentTurnAccumulatorRef.current?.reset();

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException("getUserMedia is not available in this browser", "NotSupportedError");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      const pc = new RTCPeerConnection();
      pcRef.current = pc;
      stream.getAudioTracks().forEach((track) => pc.addTrack(track, stream));
      pc.ontrack = (event) => {
        if (audioRef.current) {
          audioRef.current.srcObject = event.streams[0];
        }
      };

      const dc = pc.createDataChannel("oai-events");
      dcRef.current = dc;
      dc.addEventListener("message", handleRealtimeEvent);
      dc.addEventListener("open", () => {
        createRealtimeResponse({
          output_modalities: ["audio"],
          instructions: openingPrompt(transcriptRef.current),
        });
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("/api/hub/test/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp || "",
      });

      if (!sdpResponse.ok) {
        throw new RealtimeSessionStartError(getRealtimeSessionErrorMessage({
          status: sdpResponse.status,
          serverError: await readRealtimeSessionError(sdpResponse),
          language: lang,
        }));
      }

      setActiveTestId(sdpResponse.headers.get("x-realtime-test-id"));
      const answer: RTCSessionDescriptionInit = {
        type: "answer",
        sdp: await sdpResponse.text(),
      };
      await pc.setRemoteDescription(answer);
      startTimeRef.current = Date.now();
      statusRef.current = "live";
      setStatus("live");
    } catch (err) {
      cleanupRealtime();
      statusRef.current = "error";
      setStatus("error");
      const name = err instanceof Error ? err.name : "UnknownError";
      const message = err instanceof Error ? err.message : "";
      if (name === "RealtimeSessionStartError") {
        setError(message);
        return;
      }

      setError(getMicrophoneAccessErrorMessage({
        name,
        message,
        secureContext: window.isSecureContext,
        language: lang,
      }));
    }
  }

  function toggleMute() {
    const track = streamRef.current?.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  }

  async function finishSession() {
    setError(null);
    if (statusRef.current === "scoring" || autoFinishingRef.current) return;

    const transcriptSnapshot = transcriptRef.current;
    const progress = getRealtimeEnglishTestProgress(transcriptSnapshot);
    if (!progress.isCompleteEnough) {
      setError(copy.incompleteTest);
      return;
    }

    const activeTestId = testIdRef.current;
    if (!activeTestId) {
      setError(copy.connectionError);
      return;
    }

    if (evaluatingStudentTurnRef.current) {
      setError(copy.evaluatingFinishWait);
      return;
    }

    statusRef.current = "scoring";
    setStatus("scoring");
    autoFinishingRef.current = true;
    cancelActiveResponse();

    try {
      await persistProgress(transcriptSnapshot);
      cleanupRealtime();

      const response = await fetch("/api/hub/test/realtime/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId: activeTestId,
          transcript: transcriptSnapshot,
          durationSeconds: getDurationSeconds(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : copy.scoreError);
      }

      const nextResult = data?.result as VoiceResult;
      setResult(nextResult);
      statusRef.current = "complete";
      setStatus("complete");
      setActiveTestId(null);
      autoFinishingRef.current = false;
    } catch (err) {
      statusRef.current = "error";
      setStatus("error");
      autoFinishingRef.current = false;
      setError(err instanceof Error ? err.message : copy.scoreError);
    }
  }

  const componentScores = result
    ? [
        ["Fluency", result.fluencyScore],
        ["Pronunciation", result.pronunciationScore],
        ["Grammar", result.grammarScore],
        ["Vocabulary", result.vocabularyScore],
        ["Comprehension", result.comprehensionScore],
      ]
    : [];
  const reportArtifacts = useMemo(() => {
    if (!result) return null;
    if (result.deliveryAnalysis && result.conversationMetrics) {
      return {
        deliveryAnalysis: result.deliveryAnalysis,
        conversationMetrics: result.conversationMetrics,
      };
    }

    return buildRealtimeEnglishReportArtifacts({
      language: lang,
      transcript,
      durationSeconds: elapsedSeconds,
      result,
    });
  }, [elapsedSeconds, lang, result, transcript]);

  const roomLabel =
    status === "connecting"
      ? copy.roomConnecting
      : status === "live"
        ? evaluatingTurn
          ? copy.roomEvaluating
          : copy.roomLive
        : status === "scoring"
          ? copy.roomScoring
          : status === "complete"
            ? copy.roomComplete
            : status === "error"
              ? copy.roomError
              : copy.roomIdle;

  const isCallActive = status === "live" || status === "scoring";
  const isWaiting = status === "idle" || status === "error";
  const isBusy = status === "connecting" || status === "scoring";
  const oralLocked = oralAccess?.unlocked === false;
  const sessionState = testId ? copy.active : copy.ready;
  const microphoneState = muted ? copy.mute : copy.listening;
  const testProgress = getRealtimeEnglishTestProgress(transcript);
  const hasSavedProgress = testProgress.studentTurns > 0 && status !== "complete";

  const formattedElapsed = `${Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(elapsedSeconds % 60).toString().padStart(2, "0")}`;

  return (
    <div className="relative left-1/2 w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 space-y-4">
      <audio ref={audioRef} autoPlay />

      {/* ── Impeccable keyframes — EQ height animation + radar sweep ── */}
      <style>{`
        @keyframes eq-bar {
          0%, 100% { height: var(--h-rest); }
          50% { height: var(--h-peak); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_24px_60px_-20px_rgba(47,68,63,0.18)]">
        {/* ── Header ── */}
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/hub/test"
              aria-label={copy.fallback}
              className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            </Link>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{copy.eyebrow}</p>
              <h1 className="truncate text-lg font-black tracking-tight text-gray-950 sm:text-xl">{copy.title}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`inline-flex h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
                isCallActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : status === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-gray-200 bg-gray-50 text-gray-600"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  isCallActive ? "animate-pulse bg-emerald-500" : status === "error" ? "bg-red-500" : "bg-gray-400"
                }`}
              />
              {roomLabel}
            </div>
            <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 font-mono text-xs font-bold text-gray-700">
              <Clock3 className="h-3.5 w-3.5 text-gray-400" strokeWidth={2} />
              {formattedElapsed}
            </div>
          </div>
        </header>

        {/* ── Two-column layout ── */}
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">

          {/* ── Left: AI test stage ── */}
          <div
            className="relative flex min-h-[600px] flex-col overflow-hidden"
            style={{ backgroundColor: BRAND_COLORS.VERDE }}
          >
            {/* Primary atmospheric glow — brightens when live */}
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[38%] h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-1000"
              style={{
                backgroundColor: BRAND_COLORS.TANGERINA,
                opacity: isCallActive ? 0.12 : 0.04,
              }}
            />
            {/* Secondary warm accent — upper-right corner depth */}
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 top-0 h-[200px] w-[200px] translate-x-1/4 -translate-y-1/4 rounded-full blur-3xl transition-opacity duration-1000"
              style={{
                backgroundColor: BRAND_COLORS.CARAMELO,
                opacity: isCallActive ? 0.08 : 0.03,
              }}
            />

            {/* AI badge — top-left only, no competing box */}
            <div className="relative p-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1.5 text-xs font-bold text-white">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2} />
                {copy.aiTeacher}
              </div>
            </div>

            {/* Center: avatar + waveform + status */}
            <div className="relative flex flex-1 flex-col items-center justify-center pb-4">
              {/* Concentric ring avatar with AI glow */}
              <div className="relative flex h-60 w-60 items-center justify-center">
                {/* Dual sonar rings + conic radar sweep — live only */}
                {isCallActive && (
                  <>
                    {/* Slowly rotating conic sweep — radar / AI presence */}
                    <div
                      aria-hidden
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(transparent 0deg, transparent 200deg, ${BRAND_COLORS.TANGERINA}50 300deg, transparent 360deg)`,
                        animation: "spin-slow 7s linear infinite",
                      }}
                    />
                    <div
                      className="absolute inset-0 animate-ping rounded-full border border-white/20 opacity-40"
                      style={{ animationDuration: "3.4s" }}
                    />
                  </>
                )}
                {/* Middle ring */}
                <div
                  className={`absolute inset-5 rounded-full border transition-all duration-700 ${
                    isCallActive ? "border-white/20 bg-white/[0.06]" : "border-white/10 bg-white/[0.03]"
                  }`}
                />
                {/* Inner avatar — radial gradient + tangerina glow when live */}
                <div
                  className="absolute inset-10 flex flex-col items-center justify-center rounded-full border border-white/20 transition-all duration-700"
                  style={{
                    background: `radial-gradient(circle at 40% 35%, rgba(255,129,66,0.18), rgba(255,255,255,0.08) 70%)`,
                    boxShadow: isCallActive
                      ? `0 0 70px 18px ${BRAND_COLORS.TANGERINA}2A, inset 0 1px 0 rgba(255,255,255,0.12)`
                      : `inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }}
                >
                  {isBusy ? (
                    <Loader2 className="h-9 w-9 animate-spin text-white/60" strokeWidth={1.5} />
                  ) : (
                    <>
                      <div className="font-mono text-4xl font-black leading-none tracking-tight text-white">AI</div>
                      <div className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.22em] text-white/30">
                        examiner
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Waveform — 28 bars, real EQ height animation */}
              <div className="mt-8 flex items-end justify-center gap-[3px]" aria-hidden>
                {[6, 10, 16, 24, 18, 30, 22, 40, 30, 52, 40, 60, 40, 28, 18, 10].map((h, i) => (
                  <span
                    key={i}
                    className={`w-[4px] rounded-full transition-opacity duration-500 ${
                      isCallActive ? "opacity-90" : "opacity-[0.18]"
                    }`}
                    style={
                      isCallActive
                        ? ({
                            "--h-rest": `${Math.max(3, Math.round(h * 0.35))}px`,
                            "--h-peak": `${h}px`,
                            height: `${Math.max(3, Math.round(h * 0.35))}px`,
                            animation: `eq-bar ${0.65 + (i % 5) * 0.18}s ease-in-out ${i * 38}ms infinite`,
                            backgroundColor: BRAND_COLORS.TANGERINA,
                          } as React.CSSProperties)
                        : { height: `${h}px`, backgroundColor: BRAND_COLORS.TANGERINA }
                    }
                  />
                ))}
              </div>

              {/* Status text */}
              <div className="mt-8 min-h-[92px] px-8 text-center">
                <h2 className="text-[28px] font-extrabold leading-tight tracking-tight text-white">
                  {isBusy ? copy.scoring : evaluatingTurn ? copy.evaluatingAnswer : isCallActive ? copy.listening : copy.readyCopy}
                </h2>
                {isCallActive ? (
                  <div className="mt-3 inline-flex items-center gap-2 text-sm text-white/50">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    {copy.liveHint}
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-white/40">{roomLabel}</p>
                )}
              </div>
            </div>

            {/* Bottom strip — separator + status row + CTA */}
            <div className="relative border-t border-white/[0.07] px-5 pb-5 pt-4">
              {/* Status row: when live shows mute toggle; when idle shows feature tags */}
              {status === "live" ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white/55">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    {copy.roomLive}
                  </div>
                  <button
                    onClick={toggleMute}
                    className={`flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition active:scale-[0.97] ${
                      muted
                        ? "border border-red-300/30 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                        : "border border-white/15 bg-white/[0.08] text-white/75 hover:bg-white/15"
                    }`}
                  >
                    {muted ? (
                      <MicOff className="h-3.5 w-3.5" strokeWidth={2} />
                    ) : (
                      <Mic className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    {muted ? copy.unmute : copy.mute}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {[copy.englishOnly, copy.liveAudio, copy.cefrReady].map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/45"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white/45">
                    <Mic className="h-3.5 w-3.5" strokeWidth={2} />
                    {copy.microphone}
                  </div>
                </div>
              )}

              {/* CTA */}
              <div className="mt-3">
                {isWaiting && (
                  oralLocked ? (
                    <Link
                      href="/hub/test"
                      className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:brightness-95 active:scale-[0.99]"
                      style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
                    >
                      <FileText className="h-4 w-4" strokeWidth={2.5} />
                      {copy.writtenRequiredCta}
                    </Link>
                  ) : (
                    <button
                      onClick={startSession}
                      className="flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:brightness-95 active:scale-[0.99]"
                      style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
                    >
                      <Mic className="h-4 w-4" strokeWidth={2.5} />
                      {status === "error" ? copy.retry : copy.start}
                    </button>
                  )
                )}

                {status === "connecting" && (
                  <div className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white/10 py-3.5 text-sm font-bold text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    {copy.connecting}
                  </div>
                )}

                {status === "live" && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-3 text-sm font-semibold leading-5 text-white/75">
                    {copy.aiControlsFinish}
                  </div>
                )}

                {status === "scoring" && (
                  <div className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white/10 py-3.5 text-sm font-bold text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    {copy.scoring}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: Session controls ── */}
          <aside className="border-t border-gray-100 bg-[#FAFAF9] lg:border-l lg:border-t-0">

            {/* Session info — fixed height */}
            <div className="shrink-0 border-b border-gray-100 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{copy.controlPanel}</p>
                  <h2 className="mt-0.5 text-base font-extrabold text-gray-950">{copy.interviewer}</h2>
                </div>
                {/* Status dot — not an icon button */}
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                    isCallActive ? "bg-emerald-50" : "bg-gray-100"
                  }`}
                >
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      isCallActive ? "animate-pulse bg-emerald-500" : "bg-gray-300"
                    }`}
                  />
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {[
                  { label: copy.session, value: sessionState, dot: isCallActive ? "emerald" : "gray" },
                  { label: copy.microphone, value: microphoneState, dot: muted ? "red" : "emerald" },
                  { label: copy.language, value: "English", dot: null },
                  { label: copy.duration, value: copy.durationValue, dot: null },
                  { label: copy.assessment, value: copy.cefrReady, dot: null },
                ].map(({ label, value, dot }) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <div className="flex items-center gap-1.5">
                      {dot && (
                        <span
                          className={`h-2 w-2 rounded-full ${
                            dot === "emerald" ? "bg-emerald-500" : dot === "red" ? "bg-red-500" : "bg-gray-300"
                          }`}
                        />
                      )}
                      <span className="font-semibold text-gray-900">{value}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/50 p-3.5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
                      {copy.sections}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-gray-500">
                      {testProgress.completedStageCount}/{testProgress.requiredStudentTurns} {copy.sectionsComplete}
                    </p>
                  </div>
                  <div className="font-mono text-sm font-black text-gray-900">
                    {Math.round((testProgress.completedStageCount / testProgress.requiredStudentTurns) * 100)}%
                  </div>
                </div>

                <div className="space-y-2">
                  {REALTIME_ENGLISH_TEST_STAGES.map((stage, index) => {
                    const complete = index < testProgress.completedStageCount;
                    const current =
                      index === testProgress.completedStageCount &&
                      testProgress.completedStageCount < testProgress.requiredStudentTurns;

                    return (
                      <div key={stage.id} className="flex items-center gap-2.5">
                        <div
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            complete
                              ? "border-emerald-500 bg-emerald-500 text-white"
                              : current
                                ? "border-gray-400 bg-white"
                                : "border-gray-200 bg-white"
                          }`}
                        >
                          {complete ? (
                            <Check className="h-3 w-3" strokeWidth={3} />
                          ) : (
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                current ? "bg-gray-500" : "bg-gray-200"
                              }`}
                            />
                          )}
                        </div>
                        <span
                          className={`truncate text-xs font-semibold ${
                            complete || current ? "text-gray-800" : "text-gray-400"
                          }`}
                        >
                          {stage.title}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {hasSavedProgress && (
                  <p className="mt-3 rounded-lg bg-white px-3 py-2 text-[11px] font-medium leading-4 text-gray-500">
                    {copy.resumeNotice}
                  </p>
                )}
              </div>

              <div className="mt-3.5 flex items-center gap-2 text-[11px] text-gray-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span>{copy.privacy}</span>
              </div>
              <div className="mt-2 flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-[11px] font-medium leading-4 text-gray-500">
                <Headphones className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" strokeWidth={2} />
                <span>{copy.bestExperience}</span>
              </div>

              <div className="mt-4 rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
                  {copy.confidenceTitle}
                </p>
                <p className="mt-2 text-sm leading-5 text-gray-600">{copy.briefSummary}</p>
                <div className="mt-3 space-y-2.5">
                  {copy.confidenceBullets.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-gray-700">
                      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" strokeWidth={2.2} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50/70 p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-orange-700">
                  {copy.coachTitle}
                </p>
                <div className="mt-3 space-y-2.5">
                  {copy.coachBullets.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-sm text-orange-900">
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" strokeWidth={2.2} />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Error — fixed height */}
            {error && (
              <div className="shrink-0 border-b border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            {oralLocked && (
              <div className="shrink-0 border-b border-amber-100 bg-amber-50 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-amber-700">
                    <Lock className="h-4 w-4" strokeWidth={2.2} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-amber-900">{copy.writtenRequiredTitle}</p>
                    <p className="mt-1 text-sm leading-5 text-amber-800">
                      {oralAccess?.message || copy.writtenRequiredMessage}
                    </p>
                  </div>
                </div>
              </div>
            )}

          </aside>
        </div>
      </section>

      {/* ── Result card ── */}
      {result && (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 p-6 pb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-950">{copy.result}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                {copy.resultHint}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center">
              <span className="text-3xl font-black tracking-tight text-gray-950">{result.cefrLevel}</span>
              <span className="mt-0.5 text-[11px] font-semibold text-gray-400">{result.displayLevel}</span>
            </div>
          </div>

          <div className="px-6 pb-6">
            <div className="mb-6 flex items-start gap-5 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
              <div className="shrink-0 text-center">
                <div className="text-5xl font-black tracking-tight text-gray-950">{result.score}</div>
                <div className="text-xs text-gray-400">/100</div>
              </div>
              <p className="pt-1 text-sm leading-6 text-gray-600">{result.summary}</p>
            </div>

            <div className="mb-6 space-y-3.5">
              {componentScores.map(([label, score]) => (
                <div key={label as string}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-500">{label}</span>
                    <span className="font-bold text-gray-700">{score}/10</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${(Number(score) / 10) * 100}%`, backgroundColor: BRAND_COLORS.TANGERINA }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                  {copy.strengths}
                </p>
                <ul className="space-y-2">
                  {(result.strengths || []).map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-emerald-800">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" strokeWidth={2.5} />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-orange-700">
                  {copy.focusAreas}
                </p>
                <ul className="space-y-2">
                  {(result.focusAreas || []).map((s) => (
                    <li key={s} className="flex items-start gap-2 text-sm text-orange-800">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
                      />
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {reportArtifacts && (
              <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4">
                  <h3 className="mb-3 text-sm font-bold text-gray-900">{copy.delivery}</h3>
                  <div className="space-y-3 text-sm leading-6 text-gray-600">
                    <div>
                      <p className="font-semibold text-gray-900">{copy.fillerWords}</p>
                      <p className="mt-1">{reportArtifacts.deliveryAnalysis.fillerWordAssessment}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{copy.pace}</p>
                      <p className="mt-1">{reportArtifacts.deliveryAnalysis.paceAssessment}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{copy.tonePresence}</p>
                      <p className="mt-1">{reportArtifacts.deliveryAnalysis.toneAndPresence}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{copy.examinerRead}</p>
                      <p className="mt-1">{reportArtifacts.deliveryAnalysis.examinerRead}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-4">
                  <h3 className="mb-3 text-sm font-bold text-gray-900">{copy.conversationMetrics}</h3>
                  <div className="space-y-2.5">
                    {[
                      [copy.answers, String(reportArtifacts.conversationMetrics.studentTurns)],
                      [copy.totalWords, String(reportArtifacts.conversationMetrics.totalStudentWords)],
                      [copy.avgAnswer, String(reportArtifacts.conversationMetrics.avgWordsPerAnswer)],
                      [copy.estimatedPace, `${reportArtifacts.conversationMetrics.estimatedWordsPerMinute} wpm`],
                      [copy.fillerWords, String(reportArtifacts.conversationMetrics.fillerWordCount)],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2.5 text-sm">
                        <span className="text-gray-500">{label}</span>
                        <span className="font-semibold text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>

                  {reportArtifacts.conversationMetrics.topFillerWords.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-gray-400">{copy.topFillers}</p>
                      <div className="flex flex-wrap gap-2">
                        {reportArtifacts.conversationMetrics.topFillerWords.map((item) => (
                          <span key={item} className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-600">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {transcript.length > 0 && (
              <div className="mt-6 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50/60">
                <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-4 w-4 text-gray-400" strokeWidth={2} />
                    <div>
                      <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{copy.fullConversation}</h3>
                      <p className="mt-1 text-sm text-gray-500">{copy.conversationHint}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-0.5 font-mono text-xs font-semibold text-gray-500">
                    {transcript.length}
                  </span>
                </div>

                <div className="max-h-[520px] space-y-2 overflow-y-auto p-4">
                  {transcript.map((item, idx) => (
                    <div
                      key={`${item.at}-${idx}`}
                      className={`flex ${item.role === "student" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                          item.role === "student"
                            ? "rounded-br-sm text-white"
                            : "rounded-bl-sm border-l-2 bg-white text-gray-700 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                        }`}
                        style={
                          item.role === "student"
                            ? { backgroundColor: BRAND_COLORS.VERDE }
                            : { borderLeftColor: BRAND_COLORS.VERDE }
                        }
                      >
                        <p
                          className={`mb-1 text-[9px] font-bold uppercase tracking-[0.14em] ${
                            item.role === "student" ? "text-white/40" : "text-gray-400"
                          }`}
                        >
                          {item.role === "student" ? copy.studentLabel : copy.examinerLabel}
                        </p>
                        {item.text}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Link
              href="/hub"
              className="mt-5 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2} />
              {copy.back}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
