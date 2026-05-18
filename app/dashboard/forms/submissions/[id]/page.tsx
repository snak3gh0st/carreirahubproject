import { prisma } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { FORM_TEMPLATES, type FormField } from "@/lib/hub/form-templates";

export default async function SubmissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const submission = await prisma.formSubmission.findUnique({
    where: { id: params.id },
    include: {
      assignment: true,
      customer: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  if (!submission) {
    notFound();
  }

  const template = FORM_TEMPLATES[submission.assignment.templateId] ?? null;
  const answers = (submission.answers ?? {}) as Record<string, unknown>;

  // Build an ordered list of fields from the template. If the template is
  // missing (e.g., deleted after the submission was made), fall back to the
  // raw answer keys so nothing is lost.
  const fields: { id: string; label: string; type: string }[] = template
    ? template.fields.map((f: FormField) => ({
        id: f.id,
        label: f.label,
        type: f.type,
      }))
    : Object.keys(answers).map((key) => ({
        id: key,
        label: key,
        type: "text",
      }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-6 md:p-8 max-w-3xl">
        {/* Back link */}
        <Link
          href="/dashboard/forms"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 transition-colors mb-6"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Voltar para Formularios
        </Link>

        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold text-gray-900">
            {template ? template.title : "Resposta do Formulario"}
          </h1>
          {template && (
            <p className="text-gray-600 mt-1">{template.description}</p>
          )}
        </div>

        {/* Customer Info Card */}
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-6">
          <h2 className="text-xs font-display font-medium text-gray-500 uppercase tracking-wide mb-3">
            Cliente
          </h2>
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
              <span className="text-sm font-medium text-primary-700">
                {submission.customer.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {submission.customer.name}
              </p>
              <p className="text-xs text-gray-500">
                {submission.customer.email}
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            Enviado em{" "}
            {new Date(submission.submittedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        </div>

        {/* Submission Answers */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-sm font-display font-medium text-gray-900">
              Respostas
            </h2>
          </div>

          <div className="divide-y divide-gray-100">
            {fields.map((field) => {
              const value = answers[field.id];
              return (
                <div key={field.id} className="px-5 py-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    {field.label}
                  </p>
                  <div className="text-sm text-gray-900">
                    {renderFieldValue(field.type, value)}
                  </div>
                </div>
              );
            })}

            {fields.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-gray-500">
                Nenhuma resposta registrada.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between">
          <Link
            href="/dashboard/forms"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Voltar para Formularios
          </Link>
          <Link
            href={`/dashboard/customers/${submission.customer.id}`}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium transition-colors"
          >
            Ver perfil do cliente
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Render a field value based on its type.
 */
function renderFieldValue(type: string, value: unknown): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-gray-400 italic">Nao preenchido</span>;
  }

  if (type === "file") {
    const fileValue = String(value);
    // If it looks like a URL, render as a link
    if (
      fileValue.startsWith("http://") ||
      fileValue.startsWith("https://")
    ) {
      return (
        <a
          href={fileValue}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 underline"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Baixar arquivo
        </a>
      );
    }
    if (fileValue.startsWith("forms/") || fileValue.startsWith("contracts/")) {
      return (
        <a
          href={`/api/storage/local?key=${encodeURIComponent(fileValue)}&download=1`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary-600 hover:text-primary-700 underline"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          Baixar arquivo
        </a>
      );
    }

    // Otherwise render the legacy storage key / filename as text
    return (
      <span className="inline-flex items-center gap-1 text-gray-700">
        <svg
          className="h-4 w-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
          />
        </svg>
        {fileValue}
      </span>
    );
  }

  if (type === "checkbox") {
    const checked = value === true || value === "true";
    return (
      <span
        className={`inline-flex items-center gap-1 ${checked ? "text-green-700" : "text-gray-500"}`}
      >
        {checked ? (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
        {checked ? "Sim" : "Nao"}
      </span>
    );
  }

  if (type === "textarea") {
    return <p className="whitespace-pre-wrap">{String(value)}</p>;
  }

  // text, number, date, select, or anything else
  return <span>{String(value)}</span>;
}
