import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CoordinatorQueryProvider } from "./CoordinatorClient";
import { PhaseDistribution } from "./PhaseDistribution";

export default async function CoordinatorPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const role = (session.user as any).role as string;
  if (role !== "ADMIN") redirect("/ops");

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">
          Visão do Coordenador
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Visão geral de todos os alunos ativos
        </p>
      </div>

      <CoordinatorQueryProvider>
        <PhaseDistribution />
      </CoordinatorQueryProvider>
    </div>
  );
}
