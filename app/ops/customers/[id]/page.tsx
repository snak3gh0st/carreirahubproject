import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole } from "@/lib/roles";
import { getTemplate } from "@/lib/hub/form-templates";
import {
  ArrowUpRight,
  BookOpen,
  ChevronLeft,
  ClipboardList,
  GraduationCap,
  ShieldCheck,
  ShieldX,
  UserRound,
} from "lucide-react";

function formatDate(date: Date | null | undefined) {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "Nunca";
  return new Date(date).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getPortalStatus(
  clientUser:
    | {
        email: string;
        language: string;
        mustResetPw: boolean;
        lastLoginAt: Date | null;
        lockedUntil: Date | null;
        tempPasswordExpiresAt: Date | null;
      }
    | null,
  now: Date
) {
  if (!clientUser) {
    return {
      label: "Nao criado",
      summary: "Nenhuma conta do hub cliente foi provisionada para este cliente.",
      tone: "bg-gray-100 text-gray-700 border-gray-200",
      icon: ShieldX,
    };
  }

  if (clientUser.lockedUntil && clientUser.lockedUntil > now) {
    return {
      label: "Bloqueado",
      summary: `Conta bloqueada ate ${formatDateTime(clientUser.lockedUntil)}.`,
      tone: "bg-red-50 text-red-700 border-red-200",
      icon: ShieldX,
    };
  }

  if (clientUser.mustResetPw) {
    return {
      label: "Primeiro acesso",
      summary: clientUser.tempPasswordExpiresAt
        ? `Senha temporaria pendente ate ${formatDateTime(clientUser.tempPasswordExpiresAt)}.`
        : "Senha inicial ainda precisa ser redefinida.",
      tone: "bg-amber-50 text-amber-700 border-amber-200",
      icon: ShieldCheck,
    };
  }

  return {
    label: "Ativo",
    summary: clientUser.lastLoginAt
      ? `Ultimo acesso em ${formatDateTime(clientUser.lastLoginAt)}.`
      : "Conta pronta para uso no hub cliente.",
    tone: "bg-green-50 text-green-700 border-green-200",
    icon: ShieldCheck,
  };
}

function getFormStatus(status: "PENDING" | "IN_PROGRESS" | "COMPLETED") {
  if (status === "COMPLETED") {
    return {
      label: "Concluido",
      className: "bg-green-50 text-green-700",
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      label: "Em andamento",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Pendente",
    className: "bg-gray-100 text-gray-600",
  };
}

function getEnrollmentStatus(status: string) {
  if (status === "ACTIVE") {
    return {
      label: "Ativo",
      className: "bg-green-50 text-green-700",
    };
  }

  if (status === "PAUSED") {
    return {
      label: "Pausado",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Concluido",
    className: "bg-gray-100 text-gray-600",
  };
}

export default async function OpsCustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const role = (session.user as { role?: string }).role;
  if (!isOperationalAccessRole(role)) {
    redirect("/ops");
  }

  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      preferredLanguage: true,
      clientUser: {
        select: {
          email: true,
          language: true,
          mustResetPw: true,
          lastLoginAt: true,
          lockedUntil: true,
          tempPasswordExpiresAt: true,
        },
      },
      formAssignments: {
        orderBy: { assignedAt: "desc" },
        select: {
          id: true,
          templateId: true,
          status: true,
          assignedAt: true,
          assignedBy: {
            select: {
              name: true,
            },
          },
          submission: {
            select: {
              submittedAt: true,
            },
          },
        },
      },
      placementTests: {
        where: { totalScore: { not: -1 } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          displayLevel: true,
          cefrLevel: true,
          totalScore: true,
          questionCount: true,
          createdAt: true,
        },
      },
      englishRealtimeTests: {
        where: { status: "COMPLETED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          displayLevel: true,
          cefrLevel: true,
          score: true,
          createdAt: true,
        },
      },
      mentorshipEnrollments: {
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          id: true,
          programType: true,
          status: true,
          startDate: true,
          endDate: true,
          currentPhase: {
            select: {
              label: true,
            },
          },
          assignedTo: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  if (!customer) {
    notFound();
  }

  const now = new Date();
  const portalStatus = getPortalStatus(customer.clientUser, now);
  const PortalStatusIcon = portalStatus.icon;
  const latestTest = customer.placementTests[0] ?? null;
  const latestRealtimeTest = customer.englishRealtimeTests[0] ?? null;
  const englishTest =
    latestRealtimeTest && (!latestTest || latestRealtimeTest.createdAt > latestTest.createdAt)
      ? {
          displayLevel: latestRealtimeTest.displayLevel ?? "",
          cefrLevel: latestRealtimeTest.cefrLevel ?? "",
          scoreLabel: `${latestRealtimeTest.score ?? 0}/100`,
          createdAt: latestRealtimeTest.createdAt,
        }
      : latestTest
        ? {
            displayLevel: latestTest.displayLevel,
            cefrLevel: latestTest.cefrLevel,
            scoreLabel: `${latestTest.totalScore}/${latestTest.questionCount}`,
            createdAt: latestTest.createdAt,
          }
        : null;
  const latestEnrollment = customer.mentorshipEnrollments[0] ?? null;
  const latestEnrollmentStatus = latestEnrollment
    ? getEnrollmentStatus(latestEnrollment.status)
    : null;
  const totalForms = customer.formAssignments.length;
  const completedForms = customer.formAssignments.filter((form) => form.status === "COMPLETED").length;
  const formsProgress = totalForms === 0 ? "Sem formularios atribuidos" : `${completedForms}/${totalForms} concluidos`;
  const testsHref = `/dashboard/tests?search=${encodeURIComponent(customer.email)}`;

  return (
    <div className="p-8">
      <div className="mb-6">
        <Link
          href="/ops/pipeline"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-verde transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Voltar para clientes
        </Link>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-creme text-brand-verde">
                <UserRound className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold text-brand-verde">
                  {customer.name}
                </h1>
                <p className="text-sm text-gray-500 mt-1">{customer.email}</p>
                <p className="text-sm text-gray-500">{customer.phone ?? "Sem telefone cadastrado"}</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href={`/dashboard/customers/${customer.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-brand-verde hover:text-brand-verde transition-colors"
            >
              Cadastro financeiro
              <ArrowUpRight className="h-4 w-4" />
            </Link>
            <Link
              href="/hub/login"
              className="inline-flex items-center gap-2 rounded-xl bg-brand-verde px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-verde/90 transition-colors"
            >
              Login do hub cliente
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Portal</p>
          <p className="mt-2 text-2xl font-display font-bold text-brand-verde">{portalStatus.label}</p>
          <p className="mt-1 text-sm text-gray-500">{customer.clientUser?.language ?? customer.preferredLanguage ?? "Idioma nao definido"}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Formularios</p>
          <p className="mt-2 text-2xl font-display font-bold text-brand-verde">{totalForms}</p>
          <p className="mt-1 text-sm text-gray-500">{formsProgress}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Teste de Ingles</p>
          <p className="mt-2 text-2xl font-display font-bold text-brand-verde">
            {englishTest ? englishTest.cefrLevel : "Pendente"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {englishTest
              ? `${englishTest.displayLevel} • ${englishTest.scoreLabel}`
              : "Sem resultado concluido"}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Mentoria</p>
          <p className="mt-2 text-2xl font-display font-bold text-brand-verde">
            {latestEnrollment?.currentPhase?.label ?? latestEnrollmentStatus?.label ?? "Nao matriculado"}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {latestEnrollment
              ? `${latestEnrollment.programType} • ${latestEnrollment.assignedTo?.name ?? "Sem responsavel"}`
              : "Nenhuma matricula ativa"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 xl:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-creme text-brand-verde">
              <PortalStatusIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-brand-verde">Hub Cliente</h2>
              <p className="text-sm text-gray-500">Status de acesso e prontidao</p>
            </div>
          </div>

          <div className={`rounded-2xl border px-4 py-3 ${portalStatus.tone}`}>
            <p className="text-sm font-semibold">{portalStatus.label}</p>
            <p className="mt-1 text-sm">{portalStatus.summary}</p>
          </div>

          <dl className="mt-5 space-y-4 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Email de acesso</dt>
              <dd className="text-right text-gray-900">{customer.clientUser?.email ?? customer.email}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Idioma do portal</dt>
              <dd className="text-right text-gray-900">{customer.clientUser?.language ?? customer.preferredLanguage ?? "Nao definido"}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Ultimo login</dt>
              <dd className="text-right text-gray-900">{formatDateTime(customer.clientUser?.lastLoginAt)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Senha temporaria</dt>
              <dd className="text-right text-gray-900">
                {customer.clientUser?.mustResetPw
                  ? customer.clientUser.tempPasswordExpiresAt
                    ? `Expira em ${formatDateTime(customer.clientUser.tempPasswordExpiresAt)}`
                    : "Primeiro acesso pendente"
                  : "Configurada"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 xl:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-creme text-brand-verde">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-brand-verde">Onboarding no Hub</h2>
              <p className="text-sm text-gray-500">Formularios atribuidos ao cliente</p>
            </div>
          </div>

          {customer.formAssignments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">Nenhum formulario atribuido ao cliente.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {customer.formAssignments.slice(0, 5).map((assignment) => {
                const template = getTemplate(assignment.templateId);
                const formStatus = getFormStatus(assignment.status);

                return (
                  <div
                    key={assignment.id}
                    className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {template?.titlePt ?? assignment.templateId}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Atribuido por {assignment.assignedBy?.name ?? "Equipe"} em {formatDate(assignment.assignedAt)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${formStatus.className}`}
                      >
                        {formStatus.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {assignment.submission?.submittedAt
                        ? `Enviado em ${formatDateTime(assignment.submission.submittedAt)}`
                        : "Ainda sem envio pelo cliente"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/dashboard/forms/assign?customerId=${customer.id}`}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-brand-verde hover:text-brand-verde transition-colors"
            >
              Atribuir formulario
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 xl:col-span-1">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-creme text-brand-verde">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-brand-verde">Jornada Operacional</h2>
              <p className="text-sm text-gray-500">Matricula, fase atual e teste</p>
            </div>
          </div>

          {latestEnrollment ? (
            <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium text-gray-900">
                  {latestEnrollment.programType} • {latestEnrollment.currentPhase?.label ?? "Sem fase"}
                </p>
                {latestEnrollmentStatus && (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${latestEnrollmentStatus.className}`}
                  >
                    {latestEnrollmentStatus.label}
                  </span>
                )}
              </div>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Responsavel</dt>
                  <dd className="text-right text-gray-900">{latestEnrollment.assignedTo?.name ?? "Nao definido"}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Inicio</dt>
                  <dd className="text-right text-gray-900">{formatDate(latestEnrollment.startDate)}</dd>
                </div>
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Encerramento</dt>
                  <dd className="text-right text-gray-900">{formatDate(latestEnrollment.endDate)}</dd>
                </div>
              </dl>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">Cliente ainda sem matricula no hub operacional.</p>
            </div>
          )}

          <div className="rounded-2xl border border-gray-100 bg-gray-50/60 px-4 py-4 mt-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand-verde" />
              <p className="text-sm font-medium text-gray-900">Teste de Ingles</p>
            </div>
            <p className="text-sm text-gray-500 mt-2">
              {englishTest
                ? `${englishTest.displayLevel} (${englishTest.cefrLevel}) • ${englishTest.scoreLabel} • ${formatDate(englishTest.createdAt)}`
                : "Nenhum resultado concluido ainda."}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            {latestEnrollment && (
              <Link
                href={`/ops/students/${latestEnrollment.id}`}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-verde px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-verde/90 transition-colors"
              >
                Abrir cliente no ops
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
            {!latestEnrollment && (
              <Link
                href="/ops/enroll"
                className="inline-flex items-center gap-2 rounded-xl bg-brand-verde px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-verde/90 transition-colors"
              >
                Matricular no ops
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
            <Link
              href={testsHref}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-brand-verde hover:text-brand-verde transition-colors"
            >
              Ver testes
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
