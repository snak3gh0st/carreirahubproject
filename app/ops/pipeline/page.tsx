import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PipelineBoard } from "./PipelineBoard";

export const metadata = { title: "Pipeline | Ops Hub" };

export default async function PipelinePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");
  const role = (session.user as { role?: string }).role as string;
  if (role !== "ADMIN" && role !== "OPERATIONAL") redirect("/ops");

  const currentUserId = (session.user as { id?: string }).id as string;
  const currentUserName = (session.user as { name?: string | null }).name ?? "";

  return (
    <div className="p-6 h-screen flex flex-col">
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-2xl font-display font-bold text-brand-verde">Pipeline</h1>
        <p className="text-sm text-gray-500 mt-1">Jornada dos alunos por fase — arraste para avançar</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<PipelineSkeleton />}>
          <PipelineBoard currentUserId={currentUserId} currentUserName={currentUserName} />
        </Suspense>
      </div>
    </div>
  );
}

function PipelineSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {Array.from({ length: 11 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-56 h-80 bg-white rounded-2xl border border-gray-200 animate-pulse" />
      ))}
    </div>
  );
}
