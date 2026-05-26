import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  BadgeDollarSign,
  BriefcaseBusiness,
  CalendarClock,
  CheckSquare,
  ExternalLink,
  PlusCircle,
} from "lucide-react";

import { prisma } from "@/lib/db";
import type { Language } from "@/lib/i18n/hub";
import {
  HUB_JOB_SEARCH_RECORD_TYPES,
  HubJobSearchRecordType,
  summarizeHubJobSearchActivities,
} from "@/lib/hub/job-search-records";
import { JobSearchAddRecordButton } from "./JobSearchRecordModal";

function getPayload(token: string) {
  try {
    const [, b64] = token.split(".");
    return JSON.parse(Buffer.from(b64!, "base64url").toString());
  } catch {
    return null;
  }
}

const copy = {
  "pt-BR": {
    title: "Meus Registros",
    subtitle: "Acompanhe aplicações, entrevistas, tasks e ofertas enviadas para o time Carreira U.S.A.",
    add: "Adicionar registro",
    unavailable: "Sua matrícula ativa ainda não está disponível para registrar a busca.",
    emptyTitle: "Nenhum registro ainda",
    emptyBody: "Use o botão de adicionar para registrar a primeira aplicação, entrevista, task ou oferta.",
    all: "Todos",
    applications: "Aplicações",
    interviews: "Entrevistas",
    tasks: "Tasks",
    openTasks: "Tasks abertas",
    offers: "Ofertas",
    source: "Origem",
    jobLink: "Link da vaga",
    notes: "Notas",
    application: "Aplicação",
    interview: "Entrevista",
    task: "Task",
    offer: "Oferta",
  },
  en: {
    title: "My Records",
    subtitle: "Track applications, interviews, tasks, and offers shared with the Carreira U.S.A. team.",
    add: "Add record",
    unavailable: "Your active enrollment is not available yet for job-search records.",
    emptyTitle: "No records yet",
    emptyBody: "Use the add button to log your first application, interview, task, or offer.",
    all: "All",
    applications: "Applications",
    interviews: "Interviews",
    tasks: "Tasks",
    openTasks: "Open tasks",
    offers: "Offers",
    source: "Source",
    jobLink: "Job link",
    notes: "Notes",
    application: "Application",
    interview: "Interview",
    task: "Task",
    offer: "Offer",
  },
};

const typeMeta: Record<HubJobSearchRecordType, { icon: ReactNode; pt: string; en: string }> = {
  APPLICATION: {
    icon: <BriefcaseBusiness className="h-4 w-4" />,
    pt: "Aplicação",
    en: "Application",
  },
  INTERVIEW: {
    icon: <CalendarClock className="h-4 w-4" />,
    pt: "Entrevista",
    en: "Interview",
  },
  TASK: {
    icon: <CheckSquare className="h-4 w-4" />,
    pt: "Task",
    en: "Task",
  },
  OFFER: {
    icon: <BadgeDollarSign className="h-4 w-4" />,
    pt: "Oferta",
    en: "Offer",
  },
};

const statusLabels: Record<string, { pt: string; en: string }> = {
  PENDENTE: { pt: "Pendente", en: "Pending" },
  EM_PROCESSO: { pt: "Em processo", en: "In process" },
  CONCLUIDO: { pt: "Concluído", en: "Completed" },
  PASSOU: { pt: "Avançou", en: "Moved forward" },
  NAO_PASSOU: { pt: "Não passou", en: "Not selected" },
  NO_SHOW: { pt: "No-show", en: "No-show" },
  REMARCADO: { pt: "Remarcado", en: "Rescheduled" },
  CANCELADO: { pt: "Cancelado", en: "Canceled" },
  OFERTA: { pt: "Oferta", en: "Offer" },
  RECOLOCADO: { pt: "Aceita", en: "Accepted" },
  PERDIDO: { pt: "Perdido", en: "Lost" },
};

function typeLabel(lang: Language, type: HubJobSearchRecordType) {
  const meta = typeMeta[type];
  return lang === "pt-BR" ? meta.pt : meta.en;
}

function statusLabel(lang: Language, status: string | null) {
  if (!status) return "—";
  const label = statusLabels[status];
  if (!label) return status.replaceAll("_", " ");
  return lang === "pt-BR" ? label.pt : label.en;
}

function statusClass(status: string | null) {
  if (status === "CONCLUIDO" || status === "PASSOU" || status === "RECOLOCADO") {
    return "bg-green-50 text-green-700 border-green-100";
  }
  if (status === "NAO_PASSOU" || status === "NO_SHOW" || status === "CANCELADO" || status === "PERDIDO") {
    return "bg-red-50 text-red-700 border-red-100";
  }
  if (status === "OFERTA" || status === "REMARCADO") {
    return "bg-orange-50 text-orange-700 border-orange-100";
  }
  return "bg-gray-50 text-gray-600 border-gray-100";
}

function isRecordType(value: unknown): value is HubJobSearchRecordType {
  return HUB_JOB_SEARCH_RECORD_TYPES.includes(value as HubJobSearchRecordType);
}

export default async function HubRegistrosPage({
  searchParams,
}: {
  searchParams?: { type?: string };
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;
  if (!token) redirect("/hub/login");
  const payload = getPayload(token);
  if (!payload?.customerId) redirect("/hub/login");

  const lang = (payload.language || "en") as Language;
  const text = copy[lang];
  const dateLocale = lang === "pt-BR" ? "pt-BR" : "en-US";
  const requestedType = searchParams?.type;
  const activeType = isRecordType(requestedType) ? requestedType : null;

  const enrollment = await prisma.mentorshipEnrollment.findFirst({
    where: { customerId: payload.customerId, status: "ACTIVE" },
    select: {
      id: true,
      opsActivities: {
        where: { type: { in: ["APPLICATION", "INTERVIEW", "TASK", "OFFER"] } },
        orderBy: [{ activityDate: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          type: true,
          activityDate: true,
          company: true,
          roleTitle: true,
          source: true,
          jobUrl: true,
          salary: true,
          status: true,
          outcome: true,
          notes: true,
        },
      },
    },
  });

  const records = enrollment?.opsActivities ?? [];
  const filteredRecords = activeType
    ? records.filter((record) => record.type === activeType)
    : records;
  const summary = summarizeHubJobSearchActivities(records);
  const metrics = [
    { label: text.applications, value: summary.applications },
    { label: text.interviews, value: summary.interviews },
    { label: text.openTasks, value: summary.openTasks },
    { label: text.offers, value: summary.offers },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{text.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">{text.subtitle}</p>
        </div>
        {enrollment && <JobSearchAddRecordButton lang={lang} label={text.add} />}
      </div>

      {!enrollment ? (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 text-sm font-medium text-orange-700">
          {text.unavailable}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                <p className="text-2xl font-extrabold text-brand-verde">{metric.value}</p>
                <p className="mt-1 text-xs font-medium text-gray-500">{metric.label}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <Link
              href="/hub/registros"
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                !activeType
                  ? "border-brand-verde bg-brand-verde text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-brand-verde/30"
              }`}
            >
              {text.all}
            </Link>
            {HUB_JOB_SEARCH_RECORD_TYPES.map((type) => (
              <Link
                key={type}
                href={`/hub/registros?type=${type}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  activeType === type
                    ? "border-brand-verde bg-brand-verde text-white"
                    : "border-gray-200 bg-white text-gray-600 hover:border-brand-verde/30"
                }`}
              >
                {typeMeta[type].icon}
                {typeLabel(lang, type)}
              </Link>
            ))}
          </div>

          {filteredRecords.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-8 text-center shadow-sm">
              <PlusCircle className="mx-auto h-8 w-8 text-brand-tangerina" />
              <h2 className="mt-3 text-base font-bold text-gray-900">{text.emptyTitle}</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">{text.emptyBody}</p>
              <div className="mt-4">
                <JobSearchAddRecordButton lang={lang} label={text.add} defaultType={activeType ?? "APPLICATION"} />
              </div>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              {filteredRecords.map((record, index) => {
                const type = isRecordType(record.type) ? record.type : "APPLICATION";
                return (
                  <article
                    key={record.id}
                    className={`p-4 sm:p-5 ${index < filteredRecords.length - 1 ? "border-b border-gray-100" : ""}`}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-creme px-2.5 py-1 text-[11px] font-bold text-brand-verde">
                            {typeMeta[type].icon}
                            {typeLabel(lang, type)}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(record.status)}`}>
                            {statusLabel(lang, record.status)}
                          </span>
                        </div>
                        <h2 className="mt-2 break-words text-base font-bold text-gray-950">
                          {record.roleTitle || (lang === "pt-BR" ? "Sem título" : "Untitled")}
                        </h2>
                        {record.company && (
                          <p className="mt-0.5 text-sm font-medium text-gray-600">{record.company}</p>
                        )}
                      </div>
                      <time className="shrink-0 text-sm font-semibold text-gray-500">
                        {new Date(record.activityDate).toLocaleDateString(dateLocale, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </time>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                      {record.source && (
                        <span className="rounded-lg bg-gray-50 px-2 py-1">
                          {text.source}: {record.source}
                        </span>
                      )}
                      {record.jobUrl && (
                        <a
                          href={record.jobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2 py-1 font-semibold text-brand-tangerina hover:opacity-80"
                        >
                          {text.jobLink}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                      {record.salary && (
                        <span className="rounded-lg bg-gray-50 px-2 py-1">{record.salary}</span>
                      )}
                    </div>

                    {record.outcome && (
                      <p className="mt-3 break-words text-sm font-medium text-gray-700">{record.outcome}</p>
                    )}
                    {record.notes && (
                      <p className="mt-2 break-words text-sm text-gray-500">
                        <span className="font-semibold text-gray-600">{text.notes}: </span>
                        {record.notes}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
