import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, Lock } from "lucide-react";

import { HubHomeView } from "@/components/hub/HubHomeView";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Language } from "@/lib/i18n/hub";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prévia do portal do cliente | Ops Hub" };

function normalizeLanguage(value: string | null | undefined): Language {
  return value === "pt-BR" ? "pt-BR" : "en";
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
    select: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          preferredLanguage: true,
          clientUser: { select: { language: true } },
        },
      },
    },
  });

  if (!enrollment) redirect("/ops/pipeline");

  const language = normalizeLanguage(
    enrollment.customer.clientUser?.language ?? enrollment.customer.preferredLanguage
  );

  return (
    <div data-portal="hub-preview" className="min-h-screen bg-brand-creme">
      <div className="sticky top-0 z-20 border-b border-amber-200 bg-amber-50 px-4 py-3">
        <div className="mx-auto flex max-w-4xl flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Eye className="h-4 w-4" />
            Prévia interna - mesma home do Hub Cliente
          </div>
          <div className="flex items-center gap-2 text-xs text-amber-700">
            <Lock className="h-3.5 w-3.5" />
            Somente leitura. Nenhuma ação do cliente é executada aqui.
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-4xl space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <Link
          href={`/ops/students/${params.enrollmentId}`}
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand-verde hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao perfil operacional
        </Link>

        <HubHomeView
          customerId={enrollment.customer.id}
          lang={language}
          identity={{
            name: enrollment.customer.name,
            email: enrollment.customer.email,
          }}
          readOnly
        />
      </main>
    </div>
  );
}
