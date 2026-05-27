import Link from "next/link";
import { Users } from "lucide-react";
import EnrollForm from "./EnrollForm";

export default function EnrollPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 md:px-8 md:pt-10">
      <header className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
            Operação
          </p>
          <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-gray-900 md:text-[32px]">
            Matricular cliente
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-600">
            Crie uma nova matrícula no programa de mentoria.
          </p>
        </div>
        <Link
          href="/ops/enroll/bulk"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 transition hover:border-brand-verde hover:text-brand-verde"
        >
          <Users className="h-4 w-4" strokeWidth={1.75} />
          Matrícula em lote
        </Link>
      </header>
      <EnrollForm />
    </div>
  );
}
