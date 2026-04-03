"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { t, Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

interface FormField {
  id: string;
  type: string;
  label: string;
  labelPt: string;
  required: boolean;
  hint?: string;
  hintPt?: string;
  options?: { value: string; label: string; labelPt: string }[];
  accept?: string;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMinLabelPt?: string;
  scaleMaxLabel?: string;
  scaleMaxLabelPt?: string;
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

export default function HubFormFillPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;

  const [lang, setLang] = useState<Language>("en");
  const [template, setTemplate] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLang(getLangFromCookie());
  }, []);

  useEffect(() => {
    fetch(`/api/hub/forms/${assignmentId}`)
      .then((r) => r.json())
      .then((data) => {
        setTemplate(data.template);
        setAssignment(data.assignment);
        setSubmission(data.submission);
        if (data.submission?.answers) {
          setAnswers(data.submission.answers as Record<string, any>);
        }
      })
      .catch(() => setError(t(lang, "forms.failedToLoad")))
      .finally(() => setLoading(false));
  }, [assignmentId, lang]);

  const isReadOnly = assignment?.status === "COMPLETED";
  const isPt = lang === "pt-BR";
  const templateTitle = isPt && template?.titlePt ? template.titlePt : template?.title;
  const templateDescription =
    isPt && template?.descriptionPt ? template.descriptionPt : template?.description;

  async function handleFileUpload(fieldId: string, file: File) {
    setUploading((prev) => ({ ...prev, [fieldId]: true }));
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fieldId", fieldId);

      const res = await fetch(`/api/hub/forms/${assignmentId}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setAnswers((prev) => ({ ...prev, [fieldId]: data.key }));
      } else {
        setError(data.error || t(lang, "forms.uploadFailed"));
      }
    } catch {
      setError(t(lang, "forms.uploadFailed"));
    } finally {
      setUploading((prev) => ({ ...prev, [fieldId]: false }));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/hub/forms/${assignmentId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || t(lang, "errors.connectionError"));
        return;
      }
      router.push("/hub/forms");
    } catch {
      setError(t(lang, "errors.connectionError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 rounded-full border-t-brand-tangerina" />
      </div>
    );
  }

  if (!template) {
    return <div className="text-center py-20 text-gray-500">{t(lang, "forms.formNotFound")}</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{templateTitle}</h1>
        <p className="text-gray-500 text-sm mt-1">{templateDescription}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {(template.fields as FormField[]).map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {isPt && field.labelPt ? field.labelPt : field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>
              {(field.hint || field.hintPt) && (
                <p className="text-xs text-gray-400 mb-1.5">
                  {isPt && field.hintPt ? field.hintPt : field.hint}
                </p>
              )}

              {field.type === "text" && (
                <input
                  type="text"
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  readOnly={isReadOnly}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
                />
              )}

              {field.type === "textarea" && (
                <textarea
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  readOnly={isReadOnly}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition resize-none"
                />
              )}

              {field.type === "number" && (
                <input
                  type="number"
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  readOnly={isReadOnly}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
                />
              )}

              {field.type === "date" && (
                <input
                  type="date"
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  readOnly={isReadOnly}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
                />
              )}

              {field.type === "select" && (
                <select
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  disabled={isReadOnly}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition bg-white"
                >
                  <option value="">{t(lang, "forms.select")}</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {isPt && opt.labelPt ? opt.labelPt : opt.label}
                    </option>
                  ))}
                </select>
              )}

              {field.type === "radio" && (
                <div className="space-y-2">
                  {field.options?.map((opt) => (
                    <label key={opt.value} className="flex items-center gap-3 px-4 py-3 border border-gray-200 rounded-xl cursor-pointer transition hover:border-gray-300"
                      style={answers[field.id] === opt.value ? { borderColor: BRAND_COLORS.TANGERINA, backgroundColor: BRAND_COLORS.CREME } : {}}
                    >
                      <input
                        type="radio"
                        name={field.id}
                        value={opt.value}
                        checked={answers[field.id] === opt.value}
                        onChange={() => setAnswers((p) => ({ ...p, [field.id]: opt.value }))}
                        disabled={isReadOnly}
                        className="w-4 h-4"
                        style={{ accentColor: BRAND_COLORS.TANGERINA }}
                      />
                      <span className="text-sm text-gray-700">
                        {isPt && opt.labelPt ? opt.labelPt : opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {field.type === "scale" && (() => {
                const min = field.scaleMin ?? 1;
                const max = field.scaleMax ?? 10;
                const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
                const minLabel = isPt ? field.scaleMinLabelPt : field.scaleMinLabel;
                const maxLabel = isPt ? field.scaleMaxLabelPt : field.scaleMaxLabel;
                return (
                  <div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {values.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => !isReadOnly && setAnswers((p) => ({ ...p, [field.id]: v }))}
                          className="w-10 h-10 rounded-lg border text-sm font-medium transition"
                          style={
                            answers[field.id] === v
                              ? { backgroundColor: BRAND_COLORS.TANGERINA, borderColor: BRAND_COLORS.TANGERINA, color: "#fff" }
                              : { borderColor: "#E5E7EB", color: "#374151" }
                          }
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                    {(minLabel || maxLabel) && (
                      <div className="flex justify-between text-xs text-gray-400 mt-1.5 px-1">
                        <span>{minLabel}</span>
                        <span>{maxLabel}</span>
                      </div>
                    )}
                  </div>
                );
              })()}

              {field.type === "checkbox" && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!answers[field.id]}
                    onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.checked }))}
                    disabled={isReadOnly}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm text-gray-600">
                    {isPt && field.labelPt ? field.labelPt : field.label}
                  </span>
                </label>
              )}

              {field.type === "file" && (
                <div>
                  {answers[field.id] ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      {t(lang, "forms.fileUploaded")}
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept={field.accept || ".pdf,.jpg,.jpeg,.png,.doc,.docx"}
                      disabled={isReadOnly || uploading[field.id]}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(field.id, file);
                      }}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                    />
                  )}
                  {uploading[field.id] && (
                    <p className="text-xs text-gray-400 mt-1">{t(lang, "forms.uploading")}</p>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          {!isReadOnly && (
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-xl text-center text-white font-semibold text-base transition disabled:opacity-60 bg-brand-tangerina hover:bg-brand-tangerina/90"
            >
              {submitting ? t(lang, "forms.submitting") : t(lang, "forms.submitForm")}
            </button>
          )}

          {isReadOnly && (
            <div className="text-center py-2 text-sm text-green-600 font-medium">
              {t(lang, "forms.formSubmitted")}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
