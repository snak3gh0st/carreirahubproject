"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  ShieldCheck,
  Target,
  UserRound,
} from "lucide-react";
import type { Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

const AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS = 4;

function isMeaningfulAiMockInterviewCandidateTranscript(text: string): boolean {
  const clean = text.trim();
  if (clean.length < 10) return false;
  if (clean.split(/\s+/).length < 4) return false;
  if (/^(ok|okay|yes|no|yeah|uh|um|hmm|thanks)$/i.test(clean)) return false;
  if (/(keyboard|background noise|cough|breathing|silence)/i.test(clean)) return false;
  return true;
}

type SessionStatus = "idle" | "connecting" | "live" | "scoring" | "complete" | "error";
type RealtimeResponseRequest = Record<string, unknown>;

interface TranscriptItem {
  role: "candidate" | "interviewer";
  text: string;
  at: string;
}

interface MockInterviewReport {
  overallScore: number;
  communicationScore: number;
  experienceScore: number;
  problemSolvingScore: number;
  roleFitScore: number;
  executivePresenceScore: number;
  hiringSignal: string;
  summary: string;
  strengths: string[];
  risks: string[];
  focusAreas: string[];
  suggestedPracticeQuestions: string[];
}

class RealtimeSessionStartError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RealtimeSessionStartError";
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
      title: "AI Mock Interview",
      eyebrow: "Programa Carreira USA",
      subtitle: "Entrevista corporativa ao vivo com um entrevistador AI baseado no seu CV e objetivo profissional.",
      back: "Voltar ao programa",
      start: "Iniciar entrevista",
      retry: "Tentar novamente",
      connecting: "Abrindo sala segura...",
      live: "Entrevista ao vivo",
      finish: "Finalizar e gerar relatório",
      scoring: "Preparando relatório...",
      roomIdle: "Sala pronta",
      roomConnecting: "Conectando áudio",
      roomLive: "Entrevista em andamento",
      roomScoring: "Avaliando entrevista",
      roomComplete: "Relatório gerado",
      roomError: "Sessão interrompida",
      interviewer: "AI interviewer",
      candidate: "Candidate",
      listening: "Ouvindo sua resposta",
      readyCopy: "Pronto para começar",
      liveHint: "Responda como em uma entrevista real.",
      privacy: "Uso interno para treinamento e avaliação do programa.",
      mute: "Mutar",
      unmute: "Ativar microfone",
      microphone: "Microfone",
      session: "Sessão",
      evidence: "Evidências",
      target: "Foco",
      duration: "Tempo",
      interviewMode: "Mock interview",
      active: "Ativa",
      ready: "Pronta",
      answered: "respostas",
      transcript: "Transcript",
      emptyTranscript: "As falas capturadas aparecem aqui durante a entrevista.",
      result: "Relatório do mock interview",
      resultSaved: "Relatório salvo no programa.",
      strengths: "Pontos fortes",
      risks: "Riscos na entrevista",
      focusAreas: "Treinar agora",
      practiceQuestions: "Perguntas para praticar",
      incomplete: `A entrevista precisa de pelo menos ${AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS} respostas substanciais antes do relatório.`,
      connectionError: "Nao foi possivel iniciar o AI mock interview.",
      microphoneBlocked: "Nao foi possivel acessar o microfone. Verifique a permissao do navegador e tente novamente.",
      scoreError: "Nao foi possivel preparar o relatório. Tente finalizar novamente em alguns segundos.",
      signalStrong: "Sinal forte",
      signalPromising: "Promissor",
      signalMixed: "Misto",
      signalNotReady: "Ainda nao pronto",
    };
  }

  return {
    title: "AI Mock Interview",
    eyebrow: "Carreira USA program",
    subtitle: "Live corporate interview with an AI interviewer based on your CV and career goal.",
    back: "Back to program",
    start: "Start interview",
    retry: "Try again",
    connecting: "Opening secure room...",
    live: "Live interview",
    finish: "Finish and prepare report",
    scoring: "Preparing report...",
    roomIdle: "Room ready",
    roomConnecting: "Connecting audio",
    roomLive: "Interview in progress",
    roomScoring: "Evaluating interview",
    roomComplete: "Report generated",
    roomError: "Session interrupted",
    interviewer: "AI interviewer",
    candidate: "Candidate",
    listening: "Listening to your answer",
    readyCopy: "Ready to begin",
    liveHint: "Answer as you would in a real interview.",
    privacy: "Internal program training and evaluation use.",
    mute: "Mute",
    unmute: "Unmute",
    microphone: "Microphone",
    session: "Session",
    evidence: "Evidence",
    target: "Focus",
    duration: "Time",
    interviewMode: "Mock interview",
    active: "Active",
    ready: "Ready",
    answered: "answers",
    transcript: "Transcript",
    emptyTranscript: "Captured speech appears here during the interview.",
    result: "Mock interview report",
    resultSaved: "Report saved to your program.",
    strengths: "Strengths",
    risks: "Interview risks",
    focusAreas: "Train now",
    practiceQuestions: "Practice questions",
    incomplete: `The interview needs at least ${AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS} substantive answers before the report.`,
    connectionError: "Could not start the AI mock interview.",
    microphoneBlocked: "Could not access the microphone. Check browser permission and try again.",
    scoreError: "Could not prepare the report. Try finishing again in a few seconds.",
    signalStrong: "Strong signal",
    signalPromising: "Promising",
    signalMixed: "Mixed",
    signalNotReady: "Not ready yet",
  };
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

function isActiveResponseConflict(message: string) {
  return /active response|response is finished|response in progress/i.test(message);
}

function hiringSignalLabel(signal: string, copy: ReturnType<typeof copyFor>) {
  if (signal === "strong") return copy.signalStrong;
  if (signal === "promising") return copy.signalPromising;
  if (signal === "not_ready") return copy.signalNotReady;
  return copy.signalMixed;
}

export default function AiMockInterviewPage() {
  const [lang, setLang] = useState<Language>("en");
  const copy = useMemo(() => copyFor(lang), [lang]);
  const [status, setStatus] = useState<SessionStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [report, setReport] = useState<MockInterviewReport | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const transcriptRef = useRef<TranscriptItem[]>([]);
  const sessionIdRef = useRef<string | null>(null);
  const statusRef = useRef<SessionStatus>("idle");
  const startTimeRef = useRef<number>(0);
  const restoredDurationSecondsRef = useRef(0);
  const responseInProgressRef = useRef(false);
  const pendingInterviewerResponseRef = useRef<RealtimeResponseRequest | null>(null);
  const lastRequestedInterviewerResponseRef = useRef<RealtimeResponseRequest | null>(null);
  const recordedUsageResponseIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setLang(getLangFromCookie());
    void loadSavedProgress();
    return () => cleanupRealtime();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

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

  function setActiveSessionId(nextSessionId: string | null) {
    sessionIdRef.current = nextSessionId;
    setSessionId(nextSessionId);
  }

  async function loadSavedProgress() {
    try {
      const response = await fetch("/api/hub/mock-interview/realtime/progress", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) return;

      const data = await response.json();
      const savedTranscript = Array.isArray(data?.transcript)
        ? data.transcript.filter((item: any): item is TranscriptItem =>
            item &&
            (item.role === "candidate" || item.role === "interviewer") &&
            typeof item.text === "string"
          )
        : [];

      setActiveSessionId(typeof data?.sessionId === "string" ? data.sessionId : null);
      setTargetRole(typeof data?.targetRole === "string" ? data.targetRole : null);

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
    } catch {
      // Progress restore is best-effort.
    }
  }

  function getDurationSeconds() {
    const activeSeconds = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;
    return restoredDurationSecondsRef.current + activeSeconds;
  }

  async function persistProgress(nextTranscript: TranscriptItem[]) {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId || statusRef.current === "complete") return;

    try {
      await fetch("/api/hub/mock-interview/realtime/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          transcript: nextTranscript,
          durationSeconds: getDurationSeconds(),
        }),
      });
    } catch {
      // Do not interrupt the live interview UX.
    }
  }

  function addTranscript(role: TranscriptItem["role"], text: string) {
    const clean = text.trim();
    if (!clean) return [];

    const nextItems = [
      ...transcriptRef.current.slice(-119),
      { role, text: clean, at: new Date().toISOString() },
    ];
    transcriptRef.current = nextItems;
    setTranscript(nextItems);
    void persistProgress(nextItems);
    return nextItems;
  }

  function cleanupRealtime() {
    dcRef.current?.close();
    pcRef.current?.close();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    dcRef.current = null;
    pcRef.current = null;
    streamRef.current = null;
    responseInProgressRef.current = false;
    pendingInterviewerResponseRef.current = null;
    lastRequestedInterviewerResponseRef.current = null;
  }

  function sendRealtimeEvent(payload: Record<string, unknown>) {
    if (!dcRef.current || dcRef.current.readyState !== "open") return false;
    dcRef.current.send(JSON.stringify(payload));
    return true;
  }

  function createRealtimeResponse(response: RealtimeResponseRequest) {
    lastRequestedInterviewerResponseRef.current = response;
    const sent = sendRealtimeEvent({ type: "response.create", response });
    if (sent) responseInProgressRef.current = true;
    return sent;
  }

  function queueOrCreateRealtimeResponse(response: RealtimeResponseRequest) {
    if (statusRef.current !== "live") return;

    if (responseInProgressRef.current) {
      pendingInterviewerResponseRef.current = response;
      return;
    }

    pendingInterviewerResponseRef.current = null;
    createRealtimeResponse(response);
  }

  function flushPendingInterviewerResponse() {
    const pending = pendingInterviewerResponseRef.current;
    if (!pending || statusRef.current !== "live") return;
    pendingInterviewerResponseRef.current = null;
    createRealtimeResponse(pending);
  }

  function requestNextInterviewerTurn(candidateAnswer: string) {
    queueOrCreateRealtimeResponse({
      output_modalities: ["audio"],
      instructions: [
        "Continue the Carreira USA AI mock interview from the candidate's latest answer.",
        "Ask exactly one next interview question in English.",
        "If the latest answer was vague, generic, or lacked evidence, ask a targeted follow-up before moving to a new topic.",
        "If the answer was strong, increase difficulty with a role-specific scenario, stakeholder conflict, prioritization, or business-impact question.",
        "If the latest audio was only noise, cough, keyboard sound, breathing, or an unclear fragment, ignore it and do not ask what happened.",
        `Latest candidate answer: ${candidateAnswer}`,
      ].join(" "),
    });
  }

  async function persistRealtimeUsageEvent(payload: any) {
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) return;

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
      await fetch("/api/hub/mock-interview/realtime/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          event: payload,
        }),
      });
    } catch {
      // Internal Sigma cost tracking; never interrupt the candidate UX.
    }
  }

  function handleRealtimeEvent(event: MessageEvent<string>) {
    let payload: any;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }

    if (payload.type === "conversation.item.input_audio_transcription.completed") {
      const text = payload.transcript || "";
      if (!isMeaningfulAiMockInterviewCandidateTranscript(text)) return;
      addTranscript("candidate", text);
      requestNextInterviewerTurn(text);
      return;
    }

    if (payload.type === "response.created") {
      responseInProgressRef.current = true;
      return;
    }

    if (payload.type === "response.cancelled" || payload.type === "response.failed") {
      responseInProgressRef.current = false;
      lastRequestedInterviewerResponseRef.current = null;
      flushPendingInterviewerResponse();
      return;
    }

    if (payload.type === "error") {
      const message = payload?.error?.message || copy.connectionError;
      if (isActiveResponseConflict(message)) {
        if (lastRequestedInterviewerResponseRef.current) {
          pendingInterviewerResponseRef.current = lastRequestedInterviewerResponseRef.current;
        }
        responseInProgressRef.current = true;
        return;
      }
      setStatus("error");
      setError(message);
      cleanupRealtime();
      return;
    }

    if (payload.type === "response.output_audio_transcript.done") {
      const text = payload.transcript || payload.text || payload.delta || "";
      addTranscript("interviewer", text);
      return;
    }

    if (payload.type === "response.done") {
      void persistRealtimeUsageEvent(payload);
      responseInProgressRef.current = false;
      lastRequestedInterviewerResponseRef.current = null;
      flushPendingInterviewerResponse();
    }
  }

  async function startSession() {
    setError(null);
    setReport(null);
    await loadSavedProgress();
    const shouldResume = Boolean(sessionIdRef.current && transcriptRef.current.length > 0);
    if (!shouldResume) {
      setTranscript([]);
      transcriptRef.current = [];
      restoredDurationSecondsRef.current = 0;
      setElapsedSeconds(0);
    }

    statusRef.current = "connecting";
    setStatus("connecting");
    responseInProgressRef.current = false;
    pendingInterviewerResponseRef.current = null;
    lastRequestedInterviewerResponseRef.current = null;

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
          instructions: shouldResume
            ? "Resume the existing Carreira USA AI mock interview. Welcome the candidate back briefly and ask exactly one next interview question based on the saved context."
            : "Start the Carreira USA AI mock interview. Introduce yourself briefly as the AI interviewer, explain this is a realistic corporate mock interview based on the candidate profile and CV context, then ask exactly one strong first question.",
        });
      });

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("/api/hub/mock-interview/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/sdp" },
        body: offer.sdp || "",
      });

      if (!sdpResponse.ok) {
        const serverError = await readRealtimeSessionError(sdpResponse);
        throw new RealtimeSessionStartError(
          `${copy.connectionError}${serverError ? ` Server detail: ${serverError}` : ""}`
        );
      }

      setActiveSessionId(sdpResponse.headers.get("x-mock-interview-id"));
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
      if (err instanceof RealtimeSessionStartError) {
        setError(err.message);
        return;
      }
      setError(copy.microphoneBlocked);
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
    const activeSessionId = sessionIdRef.current;
    if (!activeSessionId) {
      setError(copy.connectionError);
      return;
    }

    const candidateTurns = transcriptRef.current.filter((item) => item.role === "candidate").length;
    if (candidateTurns < AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS) {
      setError(`${copy.incomplete} ${candidateTurns}/${AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS}.`);
      return;
    }

    statusRef.current = "scoring";
    setStatus("scoring");
    if (responseInProgressRef.current) {
      sendRealtimeEvent({ type: "response.cancel" });
    }

    try {
      const transcriptSnapshot = transcriptRef.current;
      await persistProgress(transcriptSnapshot);
      cleanupRealtime();

      const response = await fetch("/api/hub/mock-interview/realtime/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          transcript: transcriptSnapshot,
          durationSeconds: getDurationSeconds(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof data?.error === "string" ? data.error : copy.scoreError);
      }

      setReport(data?.report as MockInterviewReport);
      statusRef.current = "complete";
      setStatus("complete");
      setActiveSessionId(null);
    } catch (err) {
      statusRef.current = "error";
      setStatus("error");
      setError(err instanceof Error ? err.message : copy.scoreError);
    }
  }

  const isCallActive = status === "live" || status === "scoring";
  const isWaiting = status === "idle" || status === "error";
  const isBusy = status === "connecting" || status === "scoring";
  const candidateTurns = transcript.filter((item) => item.role === "candidate").length;
  const latestTranscript = transcript.slice(-8);
  const formattedElapsed = `${Math.floor(elapsedSeconds / 60)
    .toString()
    .padStart(2, "0")}:${(elapsedSeconds % 60).toString().padStart(2, "0")}`;

  const roomLabel =
    status === "connecting"
      ? copy.roomConnecting
      : status === "live"
        ? copy.roomLive
        : status === "scoring"
          ? copy.roomScoring
          : status === "complete"
            ? copy.roomComplete
            : status === "error"
              ? copy.roomError
              : copy.roomIdle;

  const scoreRows = report
    ? [
        ["Communication", report.communicationScore],
        ["Experience evidence", report.experienceScore],
        ["Problem solving", report.problemSolvingScore],
        ["Role fit", report.roleFitScore],
        ["Executive presence", report.executivePresenceScore],
      ]
    : [];

  return (
    <div className="relative left-1/2 w-[min(1180px,calc(100vw-2rem))] -translate-x-1/2 space-y-4">
      <audio ref={audioRef} autoPlay />

      <style>{`
        @keyframes mock-eq {
          0%, 100% { transform: scaleY(.35); opacity: .45; }
          50% { transform: scaleY(1); opacity: 1; }
        }
        @keyframes mock-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_24px_60px_-20px_rgba(47,68,63,0.18)]">
        <header className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/hub/programa"
              aria-label={copy.back}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 active:scale-95"
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
              className={`hidden h-8 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors sm:inline-flex ${
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

        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div
            className="relative flex min-h-[620px] flex-col overflow-hidden"
            style={{ backgroundColor: BRAND_COLORS.VERDE }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-[38%] h-[460px] w-[460px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl transition-opacity duration-1000"
              style={{ backgroundColor: BRAND_COLORS.TANGERINA, opacity: isCallActive ? 0.13 : 0.045 }}
            />
            <div className="relative flex items-center justify-between p-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.08] px-3.5 py-1.5 text-xs font-bold text-white">
                <BriefcaseBusiness className="h-3.5 w-3.5" strokeWidth={2} />
                {copy.interviewer}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-white/45">
                <Radio className="h-3.5 w-3.5" strokeWidth={2} />
                {copy.interviewMode}
              </div>
            </div>

            <div className="relative flex flex-1 flex-col items-center justify-center pb-6 text-center">
              <div className="relative flex h-64 w-64 items-center justify-center">
                {isCallActive && (
                  <>
                    <div
                      aria-hidden
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(transparent 0deg, transparent 210deg, ${BRAND_COLORS.TANGERINA}55 300deg, transparent 360deg)`,
                        animation: "mock-orbit 8s linear infinite",
                      }}
                    />
                    <div className="absolute inset-2 animate-ping rounded-full border border-white/20 opacity-30" style={{ animationDuration: "2.8s" }} />
                  </>
                )}
                <div className="absolute inset-8 rounded-full border border-white/15 bg-white/[0.05]" />
                <div
                  className="absolute inset-14 flex flex-col items-center justify-center rounded-full border border-white/20"
                  style={{
                    background: "radial-gradient(circle at 35% 30%, rgba(255,129,66,.18), rgba(255,255,255,.07) 72%)",
                    boxShadow: isCallActive
                      ? `0 0 76px 18px ${BRAND_COLORS.TANGERINA}2A, inset 0 1px 0 rgba(255,255,255,.12)`
                      : "inset 0 1px 0 rgba(255,255,255,.08)",
                  }}
                >
                  {isBusy ? (
                    <Loader2 className="h-10 w-10 animate-spin text-white/60" strokeWidth={1.5} />
                  ) : (
                    <>
                      <UserRound className="h-10 w-10 text-white" strokeWidth={1.5} />
                      <p className="mt-2 font-mono text-[10px] font-black uppercase tracking-[0.22em] text-white/35">
                        interviewer
                      </p>
                    </>
                  )}
                </div>
              </div>

              <div className="mt-8 flex h-14 items-center justify-center gap-[4px]" aria-hidden>
                {Array.from({ length: 24 }, (_, index) => (
                  <span
                    key={index}
                    className="h-12 w-[4px] origin-bottom rounded-full"
                    style={{
                      backgroundColor: BRAND_COLORS.TANGERINA,
                      opacity: isCallActive ? 0.9 : 0.18,
                      animation: isCallActive
                        ? `mock-eq ${0.72 + (index % 6) * 0.12}s ease-in-out ${index * 30}ms infinite`
                        : undefined,
                      transform: isCallActive ? undefined : "scaleY(.45)",
                    }}
                  />
                ))}
              </div>

              <div className="mt-7 max-w-xl px-8">
                <h2 className="text-[28px] font-extrabold leading-tight tracking-tight text-white">
                  {isBusy ? copy.scoring : isCallActive ? copy.listening : copy.readyCopy}
                </h2>
                <p className="mt-3 text-sm leading-6 text-white/50">
                  {isCallActive ? copy.liveHint : copy.subtitle}
                </p>
              </div>
            </div>

            <div className="relative border-t border-white/[0.07] px-5 pb-5 pt-4">
              {status === "live" ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-white/55">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    {copy.roomLive}
                  </div>
                  <button
                    onClick={toggleMute}
                    className={`flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition active:scale-[0.97] ${
                      muted
                        ? "border border-red-300/30 bg-red-500/20 text-red-300 hover:bg-red-500/30"
                        : "border border-white/15 bg-white/[0.08] text-white/75 hover:bg-white/15"
                    }`}
                  >
                    {muted ? <MicOff className="h-3.5 w-3.5" strokeWidth={2} /> : <Mic className="h-3.5 w-3.5" strokeWidth={2} />}
                    {muted ? copy.unmute : copy.mute}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    {[copy.duration, copy.target, copy.evidence].map((tag) => (
                      <span key={tag} className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold text-white/45">
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

              <div className="mt-3">
                {isWaiting && (
                  <button
                    onClick={startSession}
                    className="flex w-full items-center justify-center gap-2.5 rounded-xl py-3.5 text-sm font-extrabold text-white shadow-lg transition hover:brightness-95 active:scale-[0.99]"
                    style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
                  >
                    <Mic className="h-4 w-4" strokeWidth={2.5} />
                    {status === "error" ? copy.retry : copy.start}
                  </button>
                )}
                {status === "connecting" && (
                  <div className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white/10 py-3.5 text-sm font-bold text-white/60">
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                    {copy.connecting}
                  </div>
                )}
                {status === "live" && (
                  <button
                    onClick={finishSession}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-sm font-extrabold transition hover:bg-gray-100 active:scale-[0.99]"
                    style={{ color: BRAND_COLORS.VERDE }}
                  >
                    <PhoneOff className="h-4 w-4" strokeWidth={2} />
                    {copy.finish}
                  </button>
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

          <aside className="border-t border-gray-100 bg-[#FAFAF9] lg:border-l lg:border-t-0">
            <div className="border-b border-gray-100 p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{copy.session}</p>
                  <h2 className="mt-0.5 text-base font-extrabold text-gray-950">{copy.interviewer}</h2>
                </div>
                <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isCallActive ? "bg-emerald-50" : "bg-gray-100"}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${isCallActive ? "animate-pulse bg-emerald-500" : "bg-gray-300"}`} />
                </div>
              </div>

              <div className="divide-y divide-gray-100">
                {[
                  { label: copy.session, value: sessionId ? copy.active : copy.ready },
                  { label: copy.microphone, value: muted ? copy.mute : copy.listening },
                  { label: copy.evidence, value: `${candidateTurns}/${AI_MOCK_INTERVIEW_MIN_CANDIDATE_TURNS} ${copy.answered}` },
                  { label: copy.duration, value: "10-12 min" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="text-gray-500">{label}</span>
                    <span className="font-semibold text-gray-900">{value}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
                <div className="flex items-start gap-3">
                  <Target className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" strokeWidth={2} />
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">{copy.target}</p>
                    <p className="mt-1 text-sm font-semibold leading-5 text-gray-800">
                      {targetRole || copy.interviewMode}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex items-center gap-2 text-[11px] text-gray-400">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
                <span>{copy.privacy}</span>
              </div>
            </div>

            {error && (
              <div className="border-b border-red-100 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
                <div className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
                  <span>{error}</span>
                </div>
              </div>
            )}

            <div className="p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">{copy.transcript}</p>
              {latestTranscript.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {latestTranscript.map((item, idx) => (
                    <div
                      key={`${item.at}-${idx}`}
                      className={`rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${
                        item.role === "candidate"
                          ? "ml-6 text-white"
                          : "mr-6 border-l-2 bg-white text-gray-700 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                      }`}
                      style={
                        item.role === "candidate"
                          ? { backgroundColor: BRAND_COLORS.VERDE }
                          : { borderLeftColor: BRAND_COLORS.VERDE }
                      }
                    >
                      <p className={`mb-1 text-[9px] font-bold uppercase tracking-[0.14em] ${item.role === "candidate" ? "text-white/40" : "text-gray-400"}`}>
                        {item.role === "candidate" ? copy.candidate : copy.interviewer}
                      </p>
                      {item.text}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-gray-200 bg-white px-4 py-6 text-gray-400">
                  <FileText className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <p className="text-sm">{copy.emptyTranscript}</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {report && (
        <section className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-4 p-6 pb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-950">{copy.result}</h2>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="h-4 w-4" strokeWidth={2.5} />
                {copy.resultSaved}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-center rounded-2xl border border-gray-100 bg-gray-50 px-5 py-3 text-center">
              <span className="text-3xl font-black tracking-tight text-gray-950">{report.overallScore}</span>
              <span className="mt-0.5 text-[11px] font-semibold text-gray-400">/100</span>
            </div>
          </div>

          <div className="grid gap-6 px-6 pb-6 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400">
                {hiringSignalLabel(report.hiringSignal, copy)}
              </p>
              <div className="mt-4 space-y-3.5">
                {scoreRows.map(([label, score]) => (
                  <div key={label as string}>
                    <div className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-gray-500">{label}</span>
                      <span className="font-bold text-gray-700">{score}/100</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
                      <div className="h-full rounded-full" style={{ width: `${Number(score)}%`, backgroundColor: BRAND_COLORS.TANGERINA }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm leading-6 text-gray-600">{report.summary}</p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  [copy.strengths, report.strengths],
                  [copy.risks, report.risks],
                  [copy.focusAreas, report.focusAreas],
                  [copy.practiceQuestions, report.suggestedPracticeQuestions],
                ].map(([title, items]) => (
                  <div key={title as string} className="rounded-2xl border border-gray-100 p-4">
                    <h3 className="mb-3 text-sm font-bold text-gray-900">{title as string}</h3>
                    <ul className="space-y-2 text-sm leading-5 text-gray-600">
                      {(items as string[]).map((item) => (
                        <li key={item} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: BRAND_COLORS.TANGERINA }} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
