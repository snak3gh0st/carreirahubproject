import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, FileText, GraduationCap, Lock, WalletCards } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prévia do portal do cliente | Ops Hub" };

function money(value: unknown) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "USD" });
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "--";
  return new Date(value).toLocaleDateString("pt-BR");
}

export default async function StudentPortalPreviewPage({
  params,
}: {
  params: { enrollmentId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const role = (session.user as any).role as string;
  if (!isOperationalAccessRole(role)) redirect("/ops");

  const enrollment = await prisma.mentorshipEnrollment.findUnique({
    where: { id: params.enrollmentId },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          preferredLanguage: true,
          invoices: {
            orderBy: { dueDate: "asc" },
            take: 12,
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              amount: true,
              amountPaid: true,
              dueDate: true,
            },
          },
          contracts: {
            orderBy: { createdAt: "desc" },
            take: 3,
            select: { id: true, status: true, signedAt: true },
          },
          formAssignments: {
            orderBy: { assignedAt: "desc" },
            take: 8,
            select: { id: true, templateId: true, status: true, assignedAt: true },
          },
          placementTests: {
            where: { totalScore: { not: -1 } },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { displayLevel: true, cefrLevel: true, percentage: true, createdAt: true },
          },
          englishRealtimeTests: {
            where: { status: "COMPLETED" },
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { displayLevel: true, cefrLevel: true, score: true, createdAt: true },
          },
        },
      },
      currentPhase: { select: { label: true } },
      opsProfile: true,
      opsDocuments: {
        where: { visibility: "STUDENT_VISIBLE" },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          kind: true,
          title: true,
          filename: true,
          resourceType: true,
          externalUrl: true,
          uploadedAt: true,
        },
      },
    },
  });

  if (!enrollment) redirect("/ops/pipeline");

  const realtime = enrollment.customer.englishRealtimeTests[0];
  const placement = enrollment.customer.placementTests[0];
  const englishLevel =
    realtime && (!placement || realtime.createdAt > placement.createdAt)
      ? { label: realtime.displayLevel, score: realtime.score }
      : placement
        ? { label: placement.displayLevel, score: placement.percentage }
        : null;
  const openInvoices = enrollment.customer.invoices.filter((invoice) =>
    ["SENT", "OVERDUE", "PARTIALLY_PAID"].includes(invoice.status)
  );
  const totalOpen = openInvoices.reduce(
    (sum, invoice) => sum + Number(invoice.amount) - Number(invoice.amountPaid ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-brand-creme">
      <div className="sticky top-0 z-20 border-b border-amber-200 bg-amber-50 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Eye className="h-4 w-4" />
            Prévia interna - visão do cliente
          </div>
          <div className="flex items-center gap-2 text-xs text-amber-700">
            <Lock className="h-3.5 w-3.5" />
            Somente leitura. Nenhuma ação do cliente é executada aqui.
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-5 sm:px-6 md:p-8">
        <Link
          href={`/ops/students/${params.enrollmentId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-verde hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao perfil operacional
        </Link>

        <section className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Portal do cliente</p>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-display font-bold text-brand-verde">
                Olá, {enrollment.customer.name.split(" ")[0]}
              </h1>
              <p className="mt-1 break-words text-sm text-gray-500">
                {enrollment.programType} · {enrollment.currentPhase?.label ?? "Fase em preparação"}
              </p>
            </div>
            {englishLevel && (
              <div className="rounded-xl bg-brand-verde/10 px-4 py-3 text-left sm:text-right">
                <p className="text-xs font-bold uppercase text-brand-verde/70">Inglês</p>
                <p className="text-lg font-bold text-brand-verde">
                  {englishLevel.label} <span className="text-sm font-medium">({Math.round(Number(englishLevel.score ?? 0))}%)</span>
                </p>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 md:gap-5">
          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <WalletCards className="mb-3 h-5 w-5 text-brand-verde" />
            <p className="text-xs font-bold uppercase text-gray-400">Financeiro</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{money(totalOpen)}</p>
            <p className="text-xs text-gray-500">{openInvoices.length} fatura(s) em aberto</p>
          </section>
          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <FileText className="mb-3 h-5 w-5 text-brand-verde" />
            <p className="text-xs font-bold uppercase text-gray-400">Documentos</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{enrollment.opsDocuments.length}</p>
            <p className="text-xs text-gray-500">materiais visíveis</p>
          </section>
          <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
            <GraduationCap className="mb-3 h-5 w-5 text-brand-verde" />
            <p className="text-xs font-bold uppercase text-gray-400">Formulários</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">
              {enrollment.customer.formAssignments.filter((form) => form.status !== "COMPLETED").length}
            </p>
            <p className="text-xs text-gray-500">pendente(s)</p>
          </section>
        </div>

        <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
          <div className="border-b border-gray-50 px-5 py-4">
            <h2 className="font-display text-base font-bold text-gray-900">Materiais e documentos visíveis</h2>
            <p className="text-xs text-gray-400">Somente itens marcados como visíveis ao cliente aparecem aqui.</p>
          </div>
          <div className="divide-y divide-gray-50">
            {enrollment.opsDocuments.length === 0 ? (
              <div className="p-8 text-sm text-gray-400">Nenhum material público configurado.</div>
            ) : (
              enrollment.opsDocuments.map((document) => (
                <div key={document.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-gray-900">{document.title || document.filename}</p>
                    <p className="break-words text-xs text-gray-400">{document.kind} · {formatDate(document.uploadedAt)}</p>
                  </div>
                  {document.resourceType === "EXTERNAL_LINK" && document.externalUrl ? (
                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
                      Link externo
                    </span>
                  ) : (
                    <span className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-500">
                      Arquivo
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
