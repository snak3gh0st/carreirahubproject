import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PipelineBoard } from "./PipelineBoard";
import { isOperationalAccessRole } from "@/lib/roles";

export const metadata = { title: "Clientes por Area | Ops Hub" };

export default async function PipelinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");
  const role = (session.user as { role?: string }).role as string;
  if (!isOperationalAccessRole(role)) redirect("/ops");

  const currentUserId = (session.user as { id?: string }).id as string;
  const currentUserName = (session.user as { name?: string | null }).name ?? "";

  return (
    <div className="mx-auto flex max-w-[1500px] flex-col px-4 pt-8 pb-12 md:px-8 md:pt-10 xl:h-[100dvh] xl:overflow-hidden">
      <header className="mb-6 shrink-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
          Operação
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-gray-900 md:text-[32px]">
          Pipeline de clientes
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-600">
          Cada linha é um cliente ativo. Ordene por risco, filtre por fase ou responsável, clique para abrir a ficha.
        </p>
      </header>
      <div className="xl:min-h-0 xl:flex-1">
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
    <div className="space-y-1.5">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  );
}
