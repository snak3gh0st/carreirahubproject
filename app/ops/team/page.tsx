import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { UsersRound } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOperationalManagerRole, OPERATIONAL_TEAM_ROLES } from "@/lib/roles";
import { PhaseAssignment } from "../coordinator/PhaseAssignment";
import { OpsTeamClient } from "./OpsTeamClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Equipe Operacional | Ops Hub" };

export default async function OpsTeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const role = (session.user as any).role as string;
  if (!isOperationalManagerRole(role)) redirect("/ops");

  const users = await prisma.user.findMany({
    where: { role: { in: [...OPERATIONAL_TEAM_ROLES] } },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      createdAt: true,
      assignedPhases: true,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="mb-1 flex items-center gap-3">
          <UsersRound className="h-7 w-7 text-brand-verde" />
          <h1 className="text-3xl font-display font-bold text-brand-verde tracking-tight">
            Equipe Operacional
          </h1>
        </div>
        <p className="text-sm text-gray-500">
          Adicione operacionais, controle acesso e defina quais fases cada pessoa atende.
        </p>
      </div>

      <div className="space-y-6">
        <OpsTeamClient
          initialUsers={users.map((user) => ({
            ...user,
            createdAt: user.createdAt.toISOString(),
          }))}
        />

        <PhaseAssignment />
      </div>
    </div>
  );
}
