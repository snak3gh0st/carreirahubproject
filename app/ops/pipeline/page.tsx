import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PipelineBoard } from "./PipelineBoard";
import { isOperationalAccessRole } from "@/lib/roles";

export const metadata = { title: "Alunos por Area | Ops Hub" };

export default async function PipelinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");
  const role = (session.user as { role?: string }).role as string;
  if (!isOperationalAccessRole(role)) redirect("/ops");

  const currentUserId = (session.user as { id?: string }).id as string;
  const currentUserName = (session.user as { name?: string | null }).name ?? "";

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-brand-verde tracking-tight">Alunos por Area</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lista operacional por fase, responsavel, risco e progresso do aluno.
        </p>
      </div>
      <div>
        <Suspense fallback={<PipelineSkeleton />}>
          <PipelineBoard
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            currentUserRole={role}
          />
        </Suspense>
      </div>
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-xl border border-gray-200 bg-white animate-pulse" />
      ))}
    </div>
  );
}
