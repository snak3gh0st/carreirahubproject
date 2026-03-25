"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { t, Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

interface Question {
  id: string;
  section: number;
  question: string;
  options: string[];
  passage?: string;
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

const SECTION_LABEL_KEYS = [
  "test.sectionBasic",
  "test.sectionElementary",
  "test.sectionIntermediate",
  "test.sectionUpperIntermediate",
  "test.sectionAdvanced",
] as const;

export default function HubTestPage() {
  const router = useRouter();
  const [lang, setLang] = useState<Language>("en");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentSection, setCurrentSection] = useState(0); // 0 = intro
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLang(getLangFromCookie());
  }, []);

  useEffect(() => {
    fetch("/api/hub/test")
      .then((r) => r.json())
      .then((data) => setQuestions(data.questions || []))
      .catch(() => setError(t(lang, "test.failedToLoad")))
      .finally(() => setLoading(false));
  }, [lang]);

  const sections = [1, 2, 3, 4, 5];
  const sectionQuestions = questions.filter((q) => q.section === currentSection);
  const allAnswered = sectionQuestions.every((q) => answers[q.id] !== undefined);

  function handleStart() {
    setCurrentSection(1);
    setStartTime(Date.now());
  }

  function handleNext() {
    if (currentSection < 5) {
      setCurrentSection(currentSection + 1);
    }
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    const timeSpentSeconds = Math.round((Date.now() - startTime) / 1000);

    try {
      const res = await fetch("/api/hub/test/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers, timeSpentSeconds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t(lang, "test.failedToSubmit"));
        return;
      }
      window.location.href = "/hub/test/result";
    } catch {
      setError(t(lang, "errors.connectionError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 rounded-full" style={{ borderTopColor: BRAND_COLORS.TANGERINA }} />
      </div>
    );
  }

  // Intro screen
  if (currentSection === 0) {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center" style={{ backgroundColor: BRAND_COLORS.CREME }}>
          <svg className="w-10 h-10" style={{ color: BRAND_COLORS.TANGERINA }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-3">{t(lang, "test.title")}</h1>
        <p className="text-gray-500 mb-2">{t(lang, "test.questionsInfo")}</p>
        <p className="text-gray-400 text-sm mb-8 max-w-md mx-auto">
          {t(lang, "test.description")}
        </p>
        <button
          onClick={handleStart}
          className="px-8 py-4 rounded-xl text-center text-white font-semibold text-lg transition hover:opacity-90"
          style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
        >
          {t(lang, "test.startTest")}
        </button>
      </div>
    );
  }

  // Questions
  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-500">
            {t(lang, "testResult.section")} {currentSection} {t(lang, "test.sectionOf")} 5
          </span>
          <span className="text-sm text-gray-400">
            {Object.keys(answers).length}/{questions.length} {t(lang, "test.answered")}
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ backgroundColor: BRAND_COLORS.TANGERINA, width: `${(currentSection / 5) * 100}%` }}
          />
        </div>
      </div>

      {/* Section label */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900">
          {t(lang, SECTION_LABEL_KEYS[currentSection - 1]!)}
        </h2>
      </div>

      {/* Questions */}
      <div className="space-y-6">
        {sectionQuestions.map((q, qi) => (
          <div key={q.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {q.passage && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl text-sm text-gray-700 italic border-l-4" style={{ borderColor: BRAND_COLORS.TANGERINA }}>
                {q.passage}
              </div>
            )}
            <p className="font-medium text-gray-900 mb-4">
              <span className="text-gray-400 mr-2">{(currentSection - 1) * 5 + qi + 1}.</span>
              {q.question}
            </p>
            <div className="space-y-2">
              {q.options.map((opt, oi) => (
                <label
                  key={oi}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                    answers[q.id] === oi
                      ? "border-2"
                      : "border-gray-100 hover:border-gray-200"
                  }`}
                  style={answers[q.id] === oi ? { borderColor: BRAND_COLORS.TANGERINA, backgroundColor: BRAND_COLORS.CREME } : {}}
                >
                  <input
                    type="radio"
                    name={q.id}
                    checked={answers[q.id] === oi}
                    onChange={() => setAnswers((p) => ({ ...p, [q.id]: oi }))}
                    className="sr-only"
                  />
                  <div
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                    style={{
                      borderColor: answers[q.id] === oi ? BRAND_COLORS.TANGERINA : "#D1D5DB",
                    }}
                  >
                    {answers[q.id] === oi && (
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BRAND_COLORS.TANGERINA }} />
                    )}
                  </div>
                  <span className="text-sm text-gray-700">{opt}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="mt-6 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-8 flex justify-between">
        {currentSection > 1 ? (
          <button
            onClick={() => setCurrentSection(currentSection - 1)}
            className="px-6 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50 transition"
          >
            &larr; {t(lang, "test.previous")}
          </button>
        ) : (
          <div />
        )}

        {currentSection < 5 ? (
          <button
            onClick={handleNext}
            disabled={!allAnswered}
            className="px-6 py-3 rounded-xl text-center text-white font-medium text-sm transition disabled:opacity-40"
            style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
          >
            {t(lang, "test.nextSection")} &rarr;
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className="px-8 py-3 rounded-xl text-center text-white font-semibold text-sm transition disabled:opacity-40"
            style={{ backgroundColor: BRAND_COLORS.TANGERINA }}
          >
            {submitting ? t(lang, "test.submitting") : t(lang, "test.submitTest")}
          </button>
        )}
      </div>
    </div>
  );
}
