import Link from "next/link";
import { Users } from "lucide-react";
import EnrollForm from "./EnrollForm";

export default function EnrollPage() {
  return (
    <div className="p-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-brand-verde">Matricular Cliente</h1>
          <p className="text-sm text-gray-500 mt-1">Crie uma nova matrícula no programa de mentoria.</p>
        </div>
        <Link
          href="/ops/enroll/bulk"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-brand-verde hover:text-brand-verde transition-colors"
        >
          <Users className="h-4 w-4" />
          Matrícula em lote
        </Link>
      </div>
      <EnrollForm />
    </div>
  );
}
