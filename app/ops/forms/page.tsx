import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import type { FormAssignmentStatus, Prisma } from "@prisma/client";
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Inbox,
  Loader2,
  Mail,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { FORM_TEMPLATES, type FormField } from "@/lib/hub/form-templates";

type OpsFormsSearchParams = {
  status?: string;
  q?: string;
  templateId?: string;
  customerId?: string;
};

type FormAnswerMap = Record<string, unknown>;

const VALID_STATUSES = new Set(["PENDING", "IN_PROGRESS", "COMPLETED"]);

const statusMeta: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
  PENDING: {
    label: "Pendente",
    tone: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock,
  },
  IN_PROGRESS: {
    label: "Em andamento",
    tone: "border-sky-200 bg-sky-50 text-sky-700",
    icon: Loader2,
  },
  COMPLETED: {
    label: "Respondido",
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CheckCircle2,
  },
};

function fmtDate(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTemplateTitle(templateId: string) {
  const template = FORM_TEMPLATES[templateId];
  return template?.titlePt || template?.title || templateId;
}

function isEmptyAnswer(value: unknown) {
  return value === null || value === undefined || value === "";
}

function safeDecodeFilename(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function filenameFromValue(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      return safeDecodeFilename(url.pathname.split("/").pop() || url.hostname);
    } catch {
      return value;
    }
  }

  return safeDecodeFilename(value.split("/").pop() || value);
}

function getStorageDownloadHref(value: string) {
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("forms/") || value.startsWith("contracts/") || value.startsWith("ops/")) {
    return `/api/storage/local?key=${encodeURIComponent(value)}&download=1`;
  }
  return null;
}

function getSubmissionFields(templateId: string, answers: FormAnswerMap) {
  const template = FORM_TEMPLATES[templateId];
  const templateFields = template?.fields ?? [];
  const knownIds = new Set(templateFields.map((field) => field.id));
  const extraFields: FormField[] = Object.keys(answers)
    .filter((key) => !knownIds.has(key))
    .map((key) => ({
      id: key,
      type: "text",
      label: key,
      labelPt: key,
      required: false,
    }));

  return [...templateFields, ...extraFields].filter((field) =>
    Object.prototype.hasOwnProperty.call(answers, field.id)
  );
}

function renderAnswerValue(field: FormField, value: unknown) {
  if (isEmptyAnswer(value)) {
    return <span className="italic text-gray-400">Não preenchido</span>;
  }

  if (field.type === "file") {
    const fileValue = String(value);
    const href = getStorageDownloadHref(fileValue);
    if (!href) return <span className="break-all text-gray-700">{fileValue}</span>;

    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-8 max-w-full items-center gap-1.5 break-all text-xs font-semibold text-brand-verde hover:underline"
      >
        <Download className="h-3.5 w-3.5 flex-shrink-0" />
        {filenameFromValue(fileValue)}
      </a>
    );
  }

  if (field.type === "checkbox") {
    const checked = value === true || value === "true";
    return <span>{checked ? "Sim" : "Não"}</span>;
  }

  if (field.options?.length) {
    const option = field.options.find((item) => item.value === String(value));
    if (option) return <span>{option.labelPt || option.label}</span>;
  }

  if (Array.isArray(value)) return <span>{value.map(String).join(", ")}</span>;

  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
}

function countFiles(answers: FormAnswerMap | null | undefined) {
  if (!answers) return 0;
  return Object.values(answers).filter((value) => {
    if (typeof value !== "string") return false;
    return Boolean(getStorageDownloadHref(value));
  }).length;
}

export default async function OpsFormsPage({
  searchParams,
}: {
  searchParams: OpsFormsSearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/ops/login");

  const status = searchParams.status && VALID_STATUSES.has(searchParams.status)
    ? searchParams.status
    : "";
  const q = (searchParams.q ?? "").trim();
  const templateId = (searchParams.templateId ?? "").trim();
  const customerId = (searchParams.customerId ?? "").trim();

  const where: Prisma.FormAssignmentWhereInput = {};
  if (status) where.status = status as FormAssignmentStatus;
  if (templateId) where.templateId = templateId;
  if (customerId) where.customerId = customerId;
  if (q) {
    where.customer = {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const assignments = await prisma.formAssignment.findMany({
    where,
    include: {
      assignedBy: { select: { name: true, email: true } },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          mentorshipEnrollments: {
            where: { status: "ACTIVE" },
            orderBy: { updatedAt: "desc" },
            take: 1,
            select: {
              id: true,
              programType: true,
              currentPhase: { select: { label: true, key: true } },
              assignedTo: { select: { name: true } },
            },
          },
        },
      },
      submission: { select: { id: true, submittedAt: true, answers: true } },
    },
    orderBy: { assignedAt: "desc" },
  });

  const total = assignments.length;
  const pending = assignments.filter((item) => item.status === "PENDING").length;
  const inProgress = assignments.filter((item) => item.status === "IN_PROGRESS").length;
  const completed = assignments.filter((item) => item.status === "COMPLETED").length;
  const fileCount = assignments.reduce(
    (sum, item) => sum + countFiles((item.submission?.answers ?? null) as FormAnswerMap | null),
    0
  );
  const templateOptions = Object.entries(FORM_TEMPLATES).map(([id, template]) => ({
    id,
    label: template.titlePt || template.title || id,
  }));

  return (
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col px-4 py-6 md:px-8 md:py-8">
      <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            Operação
          </p>
          <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-gray-900 md:text-[32px]">
            Formulários
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-600">
            Fila operacional de formulários, respostas e arquivos enviados pelos clientes.
          </p>
        </div>
        <Link
          href="/dashboard/forms/assign"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-brand-verde px-4 text-sm font-semibold text-white transition hover:bg-brand-verde/90"
        >
          <Plus className="h-4 w-4" />
          Atribuir
        </Link>
      </header>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total", value: total, icon: FileText, tone: "text-gray-700" },
          { label: "Pendentes", value: pending, icon: Clock, tone: "text-amber-700" },
          { label: "Em andamento", value: inProgress, icon: Loader2, tone: "text-sky-700" },
          { label: "Respondidos", value: completed, icon: CheckCircle2, tone: "text-emerald-700" },
          { label: "Arquivos", value: fileCount, icon: Download, tone: "text-brand-verde" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-md border border-gray-200 bg-white p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <Icon className={`h-4 w-4 ${item.tone}`} />
                {item.label}
              </div>
              <p className={`mt-3 text-2xl font-semibold tabular-nums ${item.tone}`}>{item.value}</p>
            </div>
          );
        })}
      </section>

      <form className="mb-5 grid gap-3 rounded-md border border-gray-200 bg-white p-4 lg:grid-cols-[1fr_180px_240px_auto]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar cliente ou email"
            className="h-10 w-full rounded-md border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
          />
        </label>
        {customerId && <input type="hidden" name="customerId" value={customerId} />}
        <select
          name="status"
          defaultValue={status}
          className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
        >
          <option value="">Todos os status</option>
          <option value="PENDING">Pendentes</option>
          <option value="IN_PROGRESS">Em andamento</option>
          <option value="COMPLETED">Respondidos</option>
        </select>
        <select
          name="templateId"
          defaultValue={templateId}
          className="h-10 rounded-md border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
        >
          <option value="">Todos os formulários</option>
          {templateOptions.map((template) => (
            <option key={template.id} value={template.id}>
              {template.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
        >
          <Filter className="h-4 w-4" />
          Filtrar
        </button>
      </form>

      {assignments.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center rounded-md border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <Inbox className="h-10 w-10 text-gray-300" />
          <h2 className="mt-4 text-lg font-semibold text-gray-900">Nenhum formulário encontrado</h2>
          <p className="mt-1 text-sm text-gray-500">Ajuste os filtros ou atribua um novo formulário.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {assignments.map((assignment) => {
            const meta = statusMeta[assignment.status] ?? statusMeta.PENDING;
            const StatusIcon = meta.icon;
            const activeEnrollment = assignment.customer.mentorshipEnrollments[0] ?? null;
            const answers = (assignment.submission?.answers ?? {}) as FormAnswerMap;
            const fields = assignment.submission
              ? getSubmissionFields(assignment.templateId, answers)
              : [];
            const profileHref = activeEnrollment
              ? `/ops/students/${activeEnrollment.id}`
              : `/ops/forms?customerId=${assignment.customer.id}`;

            return (
              <article key={assignment.id} className="rounded-md border border-gray-200 bg-white">
                <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
                        <StatusIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {getTemplateTitle(assignment.templateId)}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5" />
                        {assignment.customer.name}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {assignment.customer.email}
                      </span>
                      {activeEnrollment?.currentPhase && (
                        <span>{activeEnrollment.currentPhase.label}</span>
                      )}
                      {activeEnrollment?.assignedTo?.name && (
                        <span>Resp. {activeEnrollment.assignedTo.name}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <div className="mr-2 text-xs text-gray-500">
                      <p>Atribuído {fmtDate(assignment.assignedAt)}</p>
                      {assignment.submission && <p>Respondido {fmtDate(assignment.submission.submittedAt)}</p>}
                    </div>
                    <Link
                      href={profileHref}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gray-200 px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                      Perfil
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {assignment.submission ? (
                  <details className="border-t border-gray-100">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-verde">
                      Ver respostas e arquivos enviados
                    </summary>
                    <div className="grid gap-3 px-4 pb-4 md:grid-cols-2">
                      {fields.length === 0 ? (
                        <p className="text-sm text-gray-500">Resposta enviada sem campos estruturados.</p>
                      ) : (
                        fields.map((field) => (
                          <div key={field.id} className="rounded-md border border-gray-100 bg-gray-50 px-3 py-3">
                            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                              {field.labelPt || field.label}
                            </p>
                            <div className="text-sm text-gray-800">
                              {renderAnswerValue(field, answers[field.id])}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                ) : (
                  <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
                    Cliente ainda não respondeu este formulário.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
