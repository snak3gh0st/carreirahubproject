import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";
import { AssignFormClient } from "./assign-form-client";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function AssignFormPage({
  searchParams,
}: {
  searchParams: { customerId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/auth/signin");

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 500,
  });

  const templateOptions = Object.entries(FORM_TEMPLATES).map(
    ([key, template]) => ({
      id: key,
      title: template.title,
      titlePt: template.titlePt,
      description: template.description,
      fieldCount: template.fields.length,
    })
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto p-6 md:p-8 max-w-3xl">
        <Link href="/dashboard/forms" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para Formulários
        </Link>

        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-gray-900 tracking-tight">Atribuir Formulário</h1>
          <p className="text-gray-500 mt-1">Selecione um formulário e um cliente para atribuir</p>
        </div>

        <AssignFormClient
          customers={customers}
          templateOptions={templateOptions}
          preselectedCustomerId={searchParams.customerId}
        />
      </div>
    </div>
  );
}
