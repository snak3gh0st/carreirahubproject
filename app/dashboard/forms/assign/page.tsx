import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FORM_TEMPLATES } from "@/lib/hub/form-templates";
import { AssignFormClient } from "./assign-form-client";

export default async function AssignFormPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  // Load customers for the dropdown (limited to 200 most recent, ordered by name)
  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
    take: 200,
  });

  // Build template options from FORM_TEMPLATES
  const templateOptions = Object.entries(FORM_TEMPLATES).map(
    ([key, template]) => ({
      id: key,
      title: template.title,
    })
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 md:p-8 max-w-3xl">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-gray-900">
            Atribuir Formulario
          </h1>
          <p className="text-gray-600 mt-1">
            Selecione um formulario e um cliente para atribuir
          </p>
        </div>

        <AssignFormClient
          customers={customers}
          templateOptions={templateOptions}
        />
      </div>
    </div>
  );
}
