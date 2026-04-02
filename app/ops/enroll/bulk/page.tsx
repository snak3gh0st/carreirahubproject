import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import BulkEnrollForm from "./BulkEnrollForm";

export default function BulkEnrollPage() {
  return (
    <div className="p-8">
      <div className="mb-2">
        <Link
          href="/ops/enroll"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-brand-verde transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          Matrícula individual
        </Link>
      </div>
      <div className="mb-6">
        <h1 className="text-2xl font-display font-bold text-brand-verde">Matrícula em Lote</h1>
        <p className="text-sm text-gray-500 mt-1">
          Selecione vários clientes e matricule todos de uma vez.
        </p>
      </div>
      <BulkEnrollForm />
    </div>
  );
}
