"use client";

import { useRouter } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState, useTransition } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  ExternalLink,
  Loader2,
  Plus,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Language } from "@/lib/i18n/hub";
import type { HubJobSearchRecordType } from "@/lib/hub/job-search-records";

type Summary = {
  applications: number;
  interviews: number;
  tasks: number;
  openTasks: number;
  offers: number;
  total: number;
};

type FormState = {
  type: HubJobSearchRecordType;
  activityDate: string;
  company: string;
  roleTitle: string;
  source: string;
  jobUrl: string;
  salary: string;
  status: string;
  outcome: string;
  notes: string;
};

const recordTypes: Array<{
  type: HubJobSearchRecordType;
  icon: ReactNode;
  pt: string;
  en: string;
}> = [
  { type: "APPLICATION", icon: <BriefcaseBusiness className="h-4 w-4" />, pt: "Aplicação", en: "Application" },
  { type: "INTERVIEW", icon: <CalendarClock className="h-4 w-4" />, pt: "Entrevista", en: "Interview" },
  { type: "TASK", icon: <CheckSquare className="h-4 w-4" />, pt: "Task", en: "Task" },
  { type: "OFFER", icon: <BadgeDollarSign className="h-4 w-4" />, pt: "Oferta", en: "Offer" },
];

const statusOptions: Record<HubJobSearchRecordType, Array<{ value: string; pt: string; en: string }>> = {
  APPLICATION: [
    { value: "EM_PROCESSO", pt: "Aplicado", en: "Applied" },
    { value: "PASSOU", pt: "Avançou", en: "Moved forward" },
    { value: "NAO_PASSOU", pt: "Não passou", en: "Not selected" },
    { value: "CANCELADO", pt: "Cancelado", en: "Canceled" },
  ],
  INTERVIEW: [
    { value: "EM_PROCESSO", pt: "Agendada", en: "Scheduled" },
    { value: "PASSOU", pt: "Avançou", en: "Moved forward" },
    { value: "NAO_PASSOU", pt: "Não passou", en: "Not selected" },
    { value: "REMARCADO", pt: "Remarcada", en: "Rescheduled" },
    { value: "NO_SHOW", pt: "No-show", en: "No-show" },
    { value: "CANCELADO", pt: "Cancelada", en: "Canceled" },
  ],
  TASK: [
    { value: "PENDENTE", pt: "Pendente", en: "Pending" },
    { value: "CONCLUIDO", pt: "Concluída", en: "Completed" },
    { value: "CANCELADO", pt: "Cancelada", en: "Canceled" },
  ],
  OFFER: [
    { value: "OFERTA", pt: "Recebida", en: "Received" },
    { value: "RECOLOCADO", pt: "Aceita", en: "Accepted" },
    { value: "PERDIDO", pt: "Recusada/perdida", en: "Declined/lost" },
  ],
};

const defaultStatus: Record<HubJobSearchRecordType, string> = {
  APPLICATION: "EM_PROCESSO",
  INTERVIEW: "EM_PROCESSO",
  TASK: "PENDENTE",
  OFFER: "OFERTA",
};

const copy = {
  "pt-BR": {
    title: "Registrar avanço da busca",
    subtitle: "Aplicações, entrevistas, tasks e ofertas ficam visíveis para o time operacional.",
    quickTitle: "Registrar avanço da busca",
    quickSubtitle: "Atualize aplicações, entrevistas, tasks e ofertas sem sair do Hub.",
    viewAll: "Ver tudo",
    add: "Adicionar registro",
    saving: "Salvando...",
    save: "Salvar registro",
    date: "Data",
    dueDate: "Prazo",
    company: "Empresa",
    role: "Cargo",
    taskTitle: "Título da task",
    source: "Origem",
    jobUrl: "Link da vaga",
    salary: "Salário/oferta",
    status: "Status",
    outcome: "Resultado",
    notes: "Notas",
    optional: "Opcional",
    required: "Obrigatório",
    unavailable: "A matrícula ativa ainda não está disponível para registrar a busca.",
    error: "Não foi possível salvar o registro.",
    readOnly: "Prévia somente leitura: os registros aparecem como no Hub, mas botões de criação ficam bloqueados no Ops.",
    applications: "Aplicações",
    interviews: "Entrevistas",
    openTasks: "Tasks abertas",
    offers: "Ofertas",
  },
  en: {
    title: "Log job-search progress",
    subtitle: "Applications, interviews, tasks, and offers become visible to the operations team.",
    quickTitle: "Log job-search progress",
    quickSubtitle: "Update applications, interviews, tasks, and offers without leaving the Hub.",
    viewAll: "View all",
    add: "Add record",
    saving: "Saving...",
    save: "Save record",
    date: "Date",
    dueDate: "Due date",
    company: "Company",
    role: "Role",
    taskTitle: "Task title",
    source: "Source",
    jobUrl: "Job link",
    salary: "Salary/offer",
    status: "Status",
    outcome: "Outcome",
    notes: "Notes",
    optional: "Optional",
    required: "Required",
    unavailable: "The active enrollment is not available yet for job-search records.",
    error: "Could not save this record.",
    readOnly: "Read-only preview: records appear as they do in the Hub, but creation buttons are disabled in Ops.",
    applications: "Applications",
    interviews: "Interviews",
    openTasks: "Open tasks",
    offers: "Offers",
  },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function initialForm(type: HubJobSearchRecordType): FormState {
  return {
    type,
    activityDate: today(),
    company: "",
    roleTitle: "",
    source: "",
    jobUrl: "",
    salary: "",
    status: defaultStatus[type],
    outcome: "",
    notes: "",
  };
}

function apiErrorMessage(payload: unknown, fallback: string) {
  const error = payload && typeof payload === "object" && "error" in payload
    ? (payload as { error?: unknown }).error
    : payload;

  if (typeof error === "string" && error.trim()) return error;
  if (Array.isArray(error)) return error.filter(Boolean).join("; ") || fallback;
  if (error && typeof error === "object") {
    const messages = Object.entries(error)
      .flatMap(([field, value]) => {
        if (Array.isArray(value)) return value.map((message) => `${field}: ${message}`);
        if (typeof value === "string") return [`${field}: ${value}`];
        return [];
      })
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }
  return fallback;
}

function typeLabel(lang: Language, type: HubJobSearchRecordType) {
  const item = recordTypes.find((recordType) => recordType.type === type)!;
  return lang === "pt-BR" ? item.pt : item.en;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs font-semibold text-gray-700">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-gray-400">{hint}</span>}
    </label>
  );
}

function JobSearchDialog({
  lang,
  open,
  onOpenChange,
  form,
  setForm,
}: {
  lang: Language;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: FormState;
  setForm: (form: FormState | ((current: FormState) => FormState)) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const text = copy[lang];
  const options = statusOptions[form.type];
  const selectedType = recordTypes.find((recordType) => recordType.type === form.type)!;
  const isTask = form.type === "TASK";
  const isApplication = form.type === "APPLICATION";
  const isOffer = form.type === "OFFER";

  useEffect(() => {
    if (open) setError(null);
  }, [open, form.type]);

  const update = (field: keyof FormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const changeType = (type: HubJobSearchRecordType) => {
    setError(null);
    setForm((current) => ({
      ...current,
      type,
      status: defaultStatus[type],
      company: type === "TASK" ? "" : current.company,
      jobUrl: type === "TASK" ? "" : current.jobUrl,
      salary: type === "OFFER" ? current.salary : "",
    }));
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      const res = await fetch("/api/hub/job-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        setError(apiErrorMessage(payload, text.error));
        return;
      }

      onOpenChange(false);
      setForm(initialForm(form.type));
      startTransition(() => router.refresh());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-xl border-gray-200 bg-white p-5 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-gray-950">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-tangerina/10 text-brand-tangerina">
              {selectedType.icon}
            </span>
            {text.title}
          </DialogTitle>
          <DialogDescription>{text.subtitle}</DialogDescription>
        </DialogHeader>

        <form className="space-y-4" onSubmit={submit}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {recordTypes.map((recordType) => (
              <button
                key={recordType.type}
                type="button"
                onClick={() => changeType(recordType.type)}
                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors active:scale-[0.98] ${
                  form.type === recordType.type
                    ? "border-brand-tangerina bg-brand-tangerina text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-brand-tangerina/40"
                }`}
              >
                {recordType.icon}
                {lang === "pt-BR" ? recordType.pt : recordType.en}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={isTask ? text.dueDate : text.date} hint={text.required}>
              <input
                type="date"
                value={form.activityDate}
                onChange={(event) => update("activityDate", event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
              />
            </Field>

            <Field label={text.status}>
              <select
                value={form.status}
                onChange={(event) => update("status", event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
              >
                {options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {lang === "pt-BR" ? option.pt : option.en}
                  </option>
                ))}
              </select>
            </Field>

            {!isTask && (
              <Field label={text.company} hint={text.required}>
                <input
                  value={form.company}
                  onChange={(event) => update("company", event.target.value)}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
                />
              </Field>
            )}

            <Field label={isTask ? text.taskTitle : text.role} hint={text.required}>
              <input
                value={form.roleTitle}
                onChange={(event) => update("roleTitle", event.target.value)}
                className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
              />
            </Field>

            {!isTask && (
              <Field label={text.source} hint={text.optional}>
                <input
                  value={form.source}
                  onChange={(event) => update("source", event.target.value)}
                  placeholder={lang === "pt-BR" ? "LinkedIn, Indeed, indicação..." : "LinkedIn, Indeed, referral..."}
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
                />
              </Field>
            )}

            {!isTask && !isOffer && (
              <Field label={text.jobUrl} hint={isApplication ? text.required : text.optional}>
                <input
                  value={form.jobUrl}
                  onChange={(event) => update("jobUrl", event.target.value)}
                  placeholder="https://"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
                />
              </Field>
            )}

            {isOffer && (
              <Field label={text.salary} hint={text.optional}>
                <input
                  value={form.salary}
                  onChange={(event) => update("salary", event.target.value)}
                  placeholder="$85,000"
                  className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
                />
              </Field>
            )}
          </div>

          <Field label={text.outcome} hint={text.optional}>
            <input
              value={form.outcome}
              onChange={(event) => update("outcome", event.target.value)}
              className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
            />
          </Field>

          <Field label={text.notes} hint={text.optional}>
            <textarea
              value={form.notes}
              onChange={(event) => update("notes", event.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none transition-colors focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/15"
            />
          </Field>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 active:scale-[0.98]"
            >
              {lang === "pt-BR" ? "Cancelar" : "Cancel"}
            </button>
            <button
              type="submit"
              disabled={isSaving || isPending}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-tangerina px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {(isSaving || isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving || isPending ? text.saving : text.save}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function JobSearchQuickAdd({
  lang,
  summary,
  enrollmentAvailable,
  readOnly = false,
}: {
  lang: Language;
  summary: Summary;
  enrollmentAvailable: boolean;
  readOnly?: boolean;
}) {
  const text = copy[lang];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialForm("APPLICATION"));

  const metrics = useMemo(
    () => [
      { label: text.applications, value: summary.applications },
      { label: text.interviews, value: summary.interviews },
      { label: text.openTasks, value: summary.openTasks },
      { label: text.offers, value: summary.offers },
    ],
    [summary, text]
  );

  const openFor = (type: HubJobSearchRecordType) => {
    setForm(initialForm(type));
    setOpen(true);
  };

  return (
    <section className="rounded-2xl border border-brand-verde/10 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-950">{text.quickTitle}</h2>
          <p className="mt-1 text-sm text-gray-500">{text.quickSubtitle}</p>
        </div>
        {!readOnly && (
          <a
            href="/hub/registros"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-tangerina hover:opacity-80"
          >
            {text.viewAll}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {enrollmentAvailable ? (
        <>
          {readOnly ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">
              {text.readOnly}
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {recordTypes.map((recordType) => (
                <button
                  key={recordType.type}
                  type="button"
                  onClick={() => openFor(recordType.type)}
                  className="flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 transition-colors hover:border-brand-tangerina hover:text-brand-verde active:scale-[0.98]"
                >
                  {recordType.icon}
                  {typeLabel(lang, recordType.type)}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg border border-gray-100 bg-brand-creme/40 px-3 py-2">
                <p className="text-lg font-extrabold text-brand-verde">{metric.value}</p>
                <p className="text-[11px] font-medium text-gray-500">{metric.label}</p>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-medium text-orange-700">
          {text.unavailable}
        </div>
      )}

      {!readOnly && (
        <JobSearchDialog
          lang={lang}
          open={open}
          onOpenChange={setOpen}
          form={form}
          setForm={setForm}
        />
      )}
    </section>
  );
}

export function JobSearchAddRecordButton({
  lang,
  defaultType = "APPLICATION",
  label,
}: {
  lang: Language;
  defaultType?: HubJobSearchRecordType;
  label?: string;
}) {
  const text = copy[lang];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => initialForm(defaultType));

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setForm(initialForm(defaultType));
          setOpen(true);
        }}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-tangerina px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
      >
        <Plus className="h-4 w-4" />
        {label ?? text.add}
      </button>
      <JobSearchDialog
        lang={lang}
        open={open}
        onOpenChange={setOpen}
        form={form}
        setForm={setForm}
      />
    </>
  );
}
