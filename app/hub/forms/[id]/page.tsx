"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";

const GOLD = "#C9A84C";

interface FormField {
  id: string;
  type: string;
  label: string;
  labelPt: string;
  required: boolean;
  options?: { value: string; label: string; labelPt: string }[];
}

export default function HubFormFillPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;

  const [template, setTemplate] = useState<any>(null);
  const [assignment, setAssignment] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      .catch(() => setError("Failed to load form."))
      .finally(() => setLoading(false));
  }, [assignmentId]);

  const isReadOnly = assignment?.status === "COMPLETED";

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
        setError(data.error || "Upload failed.");
      }
    } catch {
      setError("Upload failed.");
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
        setError(data.error || "Failed to submit.");
        return;
      }
      router.push("/hub/forms");
    } catch {
      setError("Connection error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-4 border-gray-200 rounded-full" style={{ borderTopColor: GOLD }} />
      </div>
    );
  }

  if (!template) {
    return <div className="text-center py-20 text-gray-500">Form not found.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{template.title}</h1>
        <p className="text-gray-500 text-sm mt-1">{template.description}</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <form onSubmit={handleSubmit} className="space-y-5">
          {(template.fields as FormField[]).map((field) => (
            <div key={field.id}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {field.label}
                {field.required && <span className="text-red-400 ml-1">*</span>}
              </label>

              {field.type === "text" && (
                <input
                  type="text"
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  readOnly={isReadOnly}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none transition"
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
              )}

              {field.type === "textarea" && (
                <textarea
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  readOnly={isReadOnly}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none transition resize-none"
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
              )}

              {field.type === "number" && (
                <input
                  type="number"
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  readOnly={isReadOnly}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none transition"
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
              )}

              {field.type === "date" && (
                <input
                  type="date"
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  readOnly={isReadOnly}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none transition"
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                />
              )}

              {field.type === "select" && (
                <select
                  value={answers[field.id] || ""}
                  onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.value }))}
                  required={field.required}
                  disabled={isReadOnly}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none transition bg-white"
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = "#E5E7EB")}
                >
                  <option value="">Select...</option>
                  {field.options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              )}

              {field.type === "checkbox" && (
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!answers[field.id]}
                    onChange={(e) => setAnswers((p) => ({ ...p, [field.id]: e.target.checked }))}
                    disabled={isReadOnly}
                    className="w-5 h-5 rounded"
                  />
                  <span className="text-sm text-gray-600">{field.label}</span>
                </label>
              )}

              {field.type === "file" && (
                <div>
                  {answers[field.id] ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      File uploaded
                    </div>
                  ) : (
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                      disabled={isReadOnly || uploading[field.id]}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(field.id, file);
                      }}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm"
                    />
                  )}
                  {uploading[field.id] && (
                    <p className="text-xs text-gray-400 mt-1">Uploading...</p>
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
              className="w-full py-4 rounded-xl text-white font-semibold text-base transition disabled:opacity-60"
              style={{ backgroundColor: GOLD }}
            >
              {submitting ? "Submitting..." : "Submit Form"}
            </button>
          )}

          {isReadOnly && (
            <div className="text-center py-2 text-sm text-green-600 font-medium">
              This form has been submitted.
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
