"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Loader2, Mic, PhoneOff, Play, Send, Volume2 } from "lucide-react";
import type { Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";
import { getMicrophoneAccessErrorMessage } from "@/lib/hub/realtime-browser-errors";
import type {
  RealtimeEnglishResult,
} from "@/lib/hub/realtime-english-test";

type VoiceStatus = "idle" | "starting" | "ready" | "recording" | "processing" | "scoring" | "complete" | "error";

interface TranscriptItem {
  role: "student" | "examiner";
  text: string;
  at: string;
  confidence?: number | null;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string; message?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
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
      eyebrow: "Entrevista oral guiada",
      title: "Teste de ingles por voz",
      subtitle: "Uma entrevista oral estruturada com perguntas em ingles, gravacao por fala do navegador e avaliacao por GPT.",
      start: "Iniciar entrevista",
      starting: "Preparando...",
      record: "Gravar resposta",
      stop: "Parar e enviar",
      processing: "Avaliando resposta...",
      finish: "Finalizar e gerar nota",
      scoring: "Gerando resultado...",
      speakAgain: "Ouvir pergunta",
      realtime: "Tentar Realtime 2",
      written: "Teste escrito",
      transcript: "Transcricao da entrevista",
      emptyTranscript: "As perguntas e respostas aparecem aqui.",
      unsupported: "Seu navegador nao oferece reconhecimento de fala. Use Chrome ou Edge para este modo.",
      noAnswer: "Nao consegui capturar a resposta. Tente gravar novamente e fale em ingles.",
      result: "Resultado da entrevista",
      saved: "Resultado salvo.",
      back: "Voltar ao painel",
      strengths: "Pontos fortes",
      focusAreas: "Focar agora",
      approx: "Modo alternativo: pronuncia e avaliada por inteligibilidade/transcricao, nao por analise fonetica direta.",
    };
  }

  return {
    eyebrow: "Guided oral interview",
    title: "Voice English Assessment",
    subtitle: "A structured English interview using browser speech capture and GPT evaluation.",
    start: "Start interview",
    starting: "Preparing...",
    record: "Record answer",
    stop: "Stop and send",
    processing: "Reviewing answer...",
    finish: "Finish and score",
    scoring: "Preparing result...",
    speakAgain: "Replay question",
    realtime: "Try Realtime 2",
    written: "Written test",
    transcript: "Interview transcript",
    emptyTranscript: "Questions and answers appear here.",
    unsupported: "Your browser does not support speech recognition. Use Chrome or Edge for this mode.",
    noAnswer: "I could not capture an answer. Try recording again and speak in English.",
    result: "Interview result",
    saved: "Result saved.",
    back: "Back to dashboard",
    strengths: "Strengths",
    focusAreas: "Focus areas",
    approx: "Fallback mode: pronunciation is scored by intelligibility/transcript clarity, not direct phonetic analysis.",
  };
}

function getSpeechRecognition(): { new(): SpeechRecognitionLike } | null {
  if (typeof window === "undefined") return null;
  return (
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition ||
    null
  );
}

export default function VoiceEnglishTestPage() {
  const [lang, setLang] = useState<Language>("en");
  const copy = useMemo(() => copyFor(lang), [lang]);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [testId, setTestId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [interimText, setInterimText] = useState("");
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [result, setResult] = useState<RealtimeEnglishResult | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recordingRef = useRef(false);
  const finalAnswerRef = useRef("");
  const confidenceRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    setLang(getLangFromCookie());
    return () => {
      recordingRef.current = false;
      recognitionRef.current?.abort();
      window.speechSynthesis?.cancel();
    };
  }, []);

  function speak(text = currentQuestion) {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  function addTranscript(item: TranscriptItem) {
    setTranscript((items) => [...items.slice(-40), item]);
  }

  async function startInterview() {
    setError(null);
    setResult(null);
    setTranscript([]);
    setStatus("starting");

    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setStatus("error");
      setError(copy.unsupported);
      return;
    }

    try {
      const response = await fetch("/api/hub/test/voice/session", { method: "POST" });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Failed to start voice interview");
      }

      setTestId(body.testId);
      setCurrentQuestion(body.examinerText);
      addTranscript({ role: "examiner", text: body.examinerText, at: new Date().toISOString() });
      startTimeRef.current = Date.now();
      setStatus("ready");
      setTimeout(() => speak(body.examinerText), 250);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to start voice interview");
    }
  }

  function startRecording() {
    const Recognition = getSpeechRecognition();
    if (!Recognition) {
      setError(copy.unsupported);
      return;
    }

    setError(null);
    setInterimText("");
    finalAnswerRef.current = "";
    confidenceRef.current = null;

    const recognition = new Recognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const resultItem = event.results[i];
        const alternative = resultItem[0];
        if (resultItem.isFinal) {
          finalAnswerRef.current = `${finalAnswerRef.current} ${alternative.transcript}`.trim();
          if (typeof alternative.confidence === "number") {
            confidenceRef.current = alternative.confidence;
          }
        } else {
          interim += alternative.transcript;
        }
      }
      setInterimText(`${finalAnswerRef.current} ${interim}`.trim());
    };
    recognition.onerror = (event) => {
      recordingRef.current = false;
      setStatus("ready");
      setError(getMicrophoneAccessErrorMessage({
        name: event.error || "SpeechRecognitionError",
        message: event.message || "",
        secureContext: window.isSecureContext,
        language: lang,
      }));
    };
    recognition.onend = () => {
      if (recordingRef.current) {
        try {
          recognition.start();
        } catch {
          // Some browsers briefly reject restart after auto-end.
        }
      }
    };

    recognitionRef.current = recognition;
    recordingRef.current = true;
    setStatus("recording");
    recognition.start();
  }

  async function stopAndSend() {
    recordingRef.current = false;
    recognitionRef.current?.stop();

    const answer = finalAnswerRef.current.trim() || interimText.trim();
    if (!testId || !answer) {
      setStatus("ready");
      setError(copy.noAnswer);
      return;
    }

    setStatus("processing");
    setInterimText("");
    addTranscript({
      role: "student",
      text: answer,
      confidence: confidenceRef.current,
      at: new Date().toISOString(),
    });

    try {
      const response = await fetch("/api/hub/test/voice/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testId,
          studentAnswer: answer,
          confidence: confidenceRef.current,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Failed to process answer");
      }

      setCurrentQuestion(body.examinerText);
      addTranscript({
        role: "examiner",
        text: body.examinerText,
        at: new Date().toISOString(),
      });
      setStatus("ready");
      setTimeout(() => speak(body.examinerText), 250);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to process answer");
    }
  }

  async function finishInterview() {
    if (!testId) return;

    setError(null);
    setStatus("scoring");
    const durationSeconds = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : null;

    try {
      const response = await fetch("/api/hub/test/voice/finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ testId, durationSeconds }),
      });
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body?.error || "Failed to finish interview");
      }
      setResult(body.result);
      setStatus("complete");
      window.speechSynthesis?.cancel();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Failed to finish interview");
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

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 mb-2">
              {copy.eyebrow}
            </p>
            <h1 className="text-2xl font-bold text-gray-900">{copy.title}</h1>
            <p className="text-sm text-gray-500 mt-2">{copy.subtitle}</p>
          </div>
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: BRAND_COLORS.CREME, color: BRAND_COLORS.TANGERINA }}
          >
            <Mic className="w-5 h-5" strokeWidth={2} />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {copy.approx}
        </div>

        {currentQuestion ? (
          <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
              Examiner
            </p>
            <p className="text-sm text-gray-800">{currentQuestion}</p>
          </div>
        ) : null}

        {interimText ? (
          <div className="mt-4 rounded-xl border border-orange-100 bg-orange-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-orange-700 mb-1">
              Student
            </p>
            <p className="text-sm text-orange-900">{interimText}</p>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          {status === "idle" || status === "error" ? (
            <button
              onClick={startInterview}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition active:scale-[0.98]"
              style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
            >
              <Play className="w-4 h-4" strokeWidth={2} />
              {copy.start}
            </button>
          ) : null}

          {status === "starting" ? (
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              {copy.starting}
            </div>
          ) : null}

          {status === "ready" ? (
            <>
              <button
                onClick={startRecording}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition active:scale-[0.98]"
                style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
              >
                <Mic className="w-4 h-4" strokeWidth={2} />
                {copy.record}
              </button>
              <button
                onClick={() => speak()}
                className="inline-flex items-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm transition hover:bg-gray-50"
              >
                <Volume2 className="w-4 h-4" strokeWidth={2} />
                {copy.speakAgain}
              </button>
              <button
                onClick={finishInterview}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition active:scale-[0.98]"
                style={{ backgroundColor: BRAND_COLORS.VERDE }}
              >
                <PhoneOff className="w-4 h-4" strokeWidth={2} />
                {copy.finish}
              </button>
            </>
          ) : null}

          {status === "recording" ? (
            <button
              onClick={stopAndSend}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-white font-semibold text-sm transition active:scale-[0.98]"
              style={{ backgroundColor: BRAND_COLORS.VERDE }}
            >
              <Send className="w-4 h-4" strokeWidth={2} />
              {copy.stop}
            </button>
          ) : null}

          {status === "processing" || status === "scoring" ? (
            <div className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm">
              <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
              {status === "scoring" ? copy.scoring : copy.processing}
            </div>
          ) : null}

          <Link
            href="/hub/test/realtime"
            className="inline-flex items-center px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm transition hover:bg-gray-50"
          >
            {copy.realtime}
          </Link>
          <Link
            href="/hub/test"
            className="inline-flex items-center px-4 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm transition hover:bg-gray-50"
          >
            {copy.written}
          </Link>
        </div>

        {error ? (
          <div className="mt-5 px-4 py-3 rounded-xl border border-red-100 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </div>

      {result ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{copy.result}</h2>
              <p className="text-sm text-green-700 font-semibold mt-1">{copy.saved}</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="text-2xl font-extrabold text-gray-900">{result.cefrLevel}</span>
            </div>
          </div>

          <p className="text-sm text-gray-500">{result.summary}</p>
          <p className="text-3xl font-extrabold text-gray-900 mt-4">
            {result.score}<span className="text-base text-gray-400">/100</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{result.displayLevel}</p>

          <div className="space-y-3 mt-5">
            {componentScores.map(([label, score]) => (
              <div key={label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-semibold text-gray-800">{score}/10</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(Number(score) / 10) * 100}%`, backgroundColor: BRAND_COLORS.TANGERINA }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="grid sm:grid-cols-2 gap-4 mt-6">
            <div className="rounded-xl bg-green-50 border border-green-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-green-700 mb-2">{copy.strengths}</p>
              <ul className="space-y-1 text-sm text-green-800">
                {(result.strengths || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div className="rounded-xl bg-orange-50 border border-orange-100 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-orange-700 mb-2">{copy.focusAreas}</p>
              <ul className="space-y-1 text-sm text-orange-800">
                {(result.focusAreas || []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>

          <Link
            href="/hub"
            className="block mt-6 py-3 text-center rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition"
          >
            {copy.back}
          </Link>
        </div>
      ) : null}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-3">{copy.transcript}</h2>
        {transcript.length > 0 ? (
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {transcript.map((item, index) => (
              <div
                key={`${item.at}-${index}`}
                className="border-l-2 pl-3"
                style={{ borderColor: item.role === "student" ? BRAND_COLORS.TANGERINA : BRAND_COLORS.VERDE }}
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-1">
                  {item.role === "student" ? "Student" : "Examiner"}
                  {typeof item.confidence === "number" ? ` · ${(item.confidence * 100).toFixed(0)}%` : ""}
                </p>
                <p className="text-sm text-gray-700">{item.text}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">{copy.emptyTranscript}</p>
        )}
      </div>
    </div>
  );
}
