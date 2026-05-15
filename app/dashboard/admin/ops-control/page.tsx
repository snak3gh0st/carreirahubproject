import Link from "next/link";
import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  AlertTriangle,
  ClipboardList,
  FileSignature,
  Receipt,
  Users,
} from "lucide-react";
import { ContractStatus, FormAssignmentStatus, InvoiceStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatMoney(value: unknown) {
  return money.format(Number(value || 0));
}

function formatDate(value: Date | null | undefined) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

function ageDays(value: Date | null | undefined, now: Date) {
  if (!value) return null;
  return Math.floor((now.getTime() - value.getTime()) / 86_400_000);
}

function OpsMetric({
  label,
  value,
  detail,
  tone = "neutral",
  icon,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "neutral" | "warning" | "critical";
  icon: ReactNode;
}) {
  const toneClass =
    tone === "critical"
      ? "border-red-200 bg-red-50 text-red-900"
      : tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-gray-200 bg-white text-gray-950";

  return (
    <div className={`rounded-lg border p-4 shadow-sm ${toneClass}`}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-white/70 text-brand-verde">
          {icon}
        </div>
      </div>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      <p className="mt-2 text-xs opacity-70">{detail}</p>
    </div>
  );
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed border-gray-200 p-4 text-sm text-gray-500">
      {label}
    </div>
  );
}

export default async function OpsControlCenterPage() {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || (role !== "ADMIN" && role !== "HEAD_OPERACIONAL")) {
    redirect("/dashboard?error=role_not_permitted");
  }

  const now = new Date();
  const nextWeek = new Date(now.getTime() + 7 * 86_400_000);
  const activeInvoiceStatuses = [
    InvoiceStatus.SENT,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.PARTIALLY_PAID,
  ];

  const [
    overdueInvoiceCount,
    dueSoonInvoiceCount,
    pendingContractCount,
    pendingFormCount,
    activeEnrollmentCount,
    overdueInvoices,
    dueSoonInvoices,
    pendingContracts,
    pendingForms,
    activeEnrollments,
  ] = await Promise.all([
    prisma.invoice.count({
      where: { status: { in: activeInvoiceStatuses }, dueDate: { lt: now } },
    }),
    prisma.invoice.count({
      where: { status: { in: activeInvoiceStatuses }, dueDate: { gte: now, lte: nextWeek } },
    }),
    prisma.contract.count({
      where: { status: { in: [ContractStatus.SENT_FOR_SIGNATURE, ContractStatus.VIEWED] } },
    }),
    prisma.formAssignment.count({
      where: { status: { in: [FormAssignmentStatus.PENDING, FormAssignmentStatus.IN_PROGRESS] } },
    }),
    prisma.mentorshipEnrollment.count({ where: { status: "ACTIVE" } }),
    prisma.invoice.findMany({
      where: { status: { in: activeInvoiceStatuses }, dueDate: { lt: now } },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        owner: { select: { name: true, email: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { status: { in: activeInvoiceStatuses }, dueDate: { gte: now, lte: nextWeek } },
      orderBy: { dueDate: "asc" },
      take: 10,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        owner: { select: { name: true, email: true } },
      },
    }),
    prisma.contract.findMany({
      where: { status: { in: [ContractStatus.SENT_FOR_SIGNATURE, ContractStatus.VIEWED] } },
      orderBy: [{ sentAt: "asc" }, { createdAt: "asc" }],
      take: 10,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        deal: { select: { title: true, value: true } },
      },
    }),
    prisma.formAssignment.findMany({
      where: { status: { in: [FormAssignmentStatus.PENDING, FormAssignmentStatus.IN_PROGRESS] } },
      orderBy: { assignedAt: "asc" },
      take: 10,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.mentorshipEnrollment.findMany({
      where: { status: "ACTIVE" },
      orderBy: { updatedAt: "asc" },
      take: 80,
      include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { name: true, email: true } },
        currentPhase: { select: { key: true, label: true, slaDays: true } },
        sessions: {
          orderBy: { sessionDate: "desc" },
          take: 1,
          select: { sessionDate: true, sessionType: true },
        },
      },
    }),
  ]);

  const staleEnrollments = activeEnrollments
    .map((enrollment) => {
      const lastSession = enrollment.sessions[0]?.sessionDate ?? null;
      const reference = lastSession || enrollment.updatedAt;
      const days = ageDays(reference, now) ?? 0;
      return { ...enrollment, lastSession, daysSinceTouch: days };
    })
    .filter((enrollment) => enrollment.daysSinceTouch >= 14)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-verde">Hub Admin</p>
            <h1 className="mt-2 text-3xl font-semibold text-gray-950">Ops Control Center</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Pendências operacionais para financeiro, contratos, formulários e jornada dos alunos.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/admin"
              className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              System Health
            </Link>
            <Link
              href="/ops"
              className="rounded-md bg-brand-verde px-3 py-2 text-sm font-semibold text-white hover:bg-brand-verde/90"
            >
              Abrir Hub Operacional
            </Link>
          </div>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <OpsMetric
            label="Invoices Vencidas"
            value={overdueInvoiceCount}
            detail="SENT, OVERDUE ou PARTIALLY_PAID"
            tone={overdueInvoiceCount > 0 ? "critical" : "neutral"}
            icon={<Receipt className="h-5 w-5" />}
          />
          <OpsMetric
            label="Vencem em 7 dias"
            value={dueSoonInvoiceCount}
            detail="Preparar cobrança antes do due date"
            tone={dueSoonInvoiceCount > 0 ? "warning" : "neutral"}
            icon={<AlertTriangle className="h-5 w-5" />}
          />
          <OpsMetric
            label="Contratos Pendentes"
            value={pendingContractCount}
            detail="Enviados ou visualizados sem assinatura"
            tone={pendingContractCount > 0 ? "warning" : "neutral"}
            icon={<FileSignature className="h-5 w-5" />}
          />
          <OpsMetric
            label="Forms Abertos"
            value={pendingFormCount}
            detail="PENDING ou IN_PROGRESS"
            tone={pendingFormCount > 0 ? "warning" : "neutral"}
            icon={<ClipboardList className="h-5 w-5" />}
          />
          <OpsMetric
            label="Alunos Ativos"
            value={activeEnrollmentCount}
            detail={`${staleEnrollments.length} sem toque recente`}
            tone={staleEnrollments.length > 0 ? "warning" : "neutral"}
            icon={<Users className="h-5 w-5" />}
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-950">Invoices Vencidas</h2>
              <Link href="/dashboard/invoices" className="text-sm font-medium text-brand-verde hover:underline">
                Ver invoices
              </Link>
            </div>
            <div className="space-y-3">
              {overdueInvoices.length === 0 ? (
                <EmptyLine label="Nenhuma invoice vencida aberta." />
              ) : (
                overdueInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="block rounded-md border border-red-100 bg-red-50/50 p-3 hover:bg-red-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-950">
                          {invoice.customer.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Due {formatDate(invoice.dueDate)} · {invoice.owner?.name || invoice.owner?.email || "sem owner"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-700">{formatMoney(invoice.amount)}</p>
                        <p className="mt-1 text-xs text-gray-500">{invoice.status}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-950">Vencem em 7 dias</h2>
              <Link href="/dashboard/admin" className="text-sm font-medium text-brand-verde hover:underline">
                Rodar cobrança
              </Link>
            </div>
            <div className="space-y-3">
              {dueSoonInvoices.length === 0 ? (
                <EmptyLine label="Nenhuma invoice vence nos próximos 7 dias." />
              ) : (
                dueSoonInvoices.map((invoice) => (
                  <Link
                    key={invoice.id}
                    href={`/dashboard/invoices/${invoice.id}`}
                    className="block rounded-md border border-amber-100 bg-amber-50/60 p-3 hover:bg-amber-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-950">
                          {invoice.customer.name}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Due {formatDate(invoice.dueDate)} · {invoice.owner?.name || invoice.owner?.email || "sem owner"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-amber-800">{formatMoney(invoice.amount)}</p>
                        <p className="mt-1 text-xs text-gray-500">{invoice.status}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-950">Contratos Pendentes</h2>
              <Link href="/dashboard/contracts" className="text-sm font-medium text-brand-verde hover:underline">
                Ver contratos
              </Link>
            </div>
            <div className="space-y-3">
              {pendingContracts.length === 0 ? (
                <EmptyLine label="Nenhum contrato aguardando assinatura." />
              ) : (
                pendingContracts.map((contract) => (
                  <Link
                    key={contract.id}
                    href={`/dashboard/contracts/${contract.id}`}
                    className="block rounded-md border border-gray-100 bg-gray-50 p-3 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-950">{contract.customer.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {contract.deal.title} · sent {formatDate(contract.sentAt || contract.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-gray-800">{formatMoney(contract.deal.value)}</p>
                        <p className="mt-1 text-xs text-gray-500">{contract.status}</p>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>

          <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-950">Forms em Aberto</h2>
              <Link href="/ops" className="text-sm font-medium text-brand-verde hover:underline">
                Ver operação
              </Link>
            </div>
            <div className="space-y-3">
              {pendingForms.length === 0 ? (
                <EmptyLine label="Nenhum formulário pendente." />
              ) : (
                pendingForms.map((form) => (
                  <Link
                    key={form.id}
                    href={`/dashboard/customers/${form.customer.id}`}
                    className="block rounded-md border border-gray-100 bg-gray-50 p-3 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-950">{form.customer.name}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Assigned {formatDate(form.assignedAt)} · by {form.assignedBy.name || form.assignedBy.email}
                        </p>
                      </div>
                      <p className="text-xs font-semibold text-amber-700">{form.status}</p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-950">Alunos sem toque recente</h2>
            <Link href="/ops" className="text-sm font-medium text-brand-verde hover:underline">
              Abrir fila operacional
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {staleEnrollments.length === 0 ? (
              <div className="md:col-span-2">
                <EmptyLine label="Nenhum aluno ativo sem toque recente na amostra atual." />
              </div>
            ) : (
              staleEnrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  href={`/ops/students/${enrollment.id}`}
                  className="rounded-md border border-amber-100 bg-amber-50/50 p-3 hover:bg-amber-50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-950">{enrollment.customer.name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {enrollment.currentPhase?.label || "sem fase"} · owner {enrollment.assignedTo.name || enrollment.assignedTo.email}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        Last session: {formatDate(enrollment.lastSession)}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-amber-800">
                      {enrollment.daysSinceTouch}d
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
