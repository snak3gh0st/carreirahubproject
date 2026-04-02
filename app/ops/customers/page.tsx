import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Link from "next/link";

function getEnrollmentStatus(status: string) {
  if (status === "ACTIVE") {
    return {
      label: "Ativo",
      className: "bg-green-50 text-green-700",
    };
  }

  if (status === "PAUSED") {
    return {
      label: "Pausado",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Concluido",
    className: "bg-gray-100 text-gray-600",
  };
}

function getPortalStatus(
  clientUser:
    | {
        id: string;
        mustResetPw: boolean;
        lockedUntil: Date | null;
      }
    | null
    | undefined,
  now: Date
) {
  if (!clientUser) {
    return {
      label: "Nao criado",
      detail: "Sem acesso ao hub cliente",
      className: "bg-gray-100 text-gray-600",
    };
  }

  if (clientUser.lockedUntil && clientUser.lockedUntil > now) {
    return {
      label: "Bloqueado",
      detail: "Conta temporariamente travada",
      className: "bg-red-50 text-red-600",
    };
  }

  if (clientUser.mustResetPw) {
    return {
      label: "Primeiro acesso",
      detail: "Senha inicial ainda pendente",
      className: "bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Ativo",
    detail: "Hub cliente pronto para uso",
    className: "bg-green-50 text-green-700",
  };
}

export default async function OpsCustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const now = new Date();

  const allEnrollments = await prisma.mentorshipEnrollment.findMany({
    where: {
      programType: {
        in: ["PASS", "ADVANCED"],
      },
    },
    orderBy: { startDate: "desc" },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          clientUser: {
            select: {
              id: true,
              mustResetPw: true,
              lockedUntil: true,
            },
          },
        },
      },
      currentPhase: { select: { label: true } },
      assignedTo: { select: { name: true } },
      transitions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });
  const enrollments = Array.from(
    new Map(allEnrollments.map((enrollment) => [enrollment.customerId, enrollment])).values()
  );
  const counts = enrollments.reduce(
    (acc, enrollment) => {
      acc.total += 1;
      if (enrollment.status === "ACTIVE") acc.active += 1;
      if (enrollment.status === "PAUSED") acc.paused += 1;
      if (enrollment.status === "COMPLETED") acc.completed += 1;
      return acc;
    },
    { total: 0, active: 0, paused: 0, completed: 0 }
  );

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">Clientes</h1>
        <p className="text-gray-500 text-sm mt-1">
          {counts.total} cliente{counts.total !== 1 ? "s" : ""} dos programas PASS e ADVANCED
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Total</p>
          <p className="mt-2 text-2xl font-display font-bold text-brand-verde">{counts.total}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Ativos</p>
          <p className="mt-2 text-2xl font-display font-bold text-brand-verde">{counts.active}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Pausados</p>
          <p className="mt-2 text-2xl font-display font-bold text-brand-verde">{counts.paused}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Concluidos</p>
          <p className="mt-2 text-2xl font-display font-bold text-brand-verde">{counts.completed}</p>
        </div>
      </div>

      {enrollments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">Nenhum cliente PASS ou ADVANCED encontrado.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Aluno</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Portal</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Programa</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fase Atual</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Responsável</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dias na Fase</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {enrollments.map((e) => {
                const lastTransition = e.transitions[0];
                const since = lastTransition
                  ? new Date(lastTransition.createdAt).getTime()
                  : new Date(e.startDate).getTime();
                const daysInPhase = Math.floor((Date.now() - since) / 86_400_000);
                const portalStatus = getPortalStatus(e.customer.clientUser, now);
                const enrollmentStatus = getEnrollmentStatus(e.status);

                return (
                  <tr key={e.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <Link
                        href={`/ops/customers/${e.customer.id}`}
                        className="font-medium text-gray-900 hover:text-brand-verde transition-colors"
                      >
                        {e.customer.name}
                      </Link>
                      <p className="text-xs text-gray-400">{e.customer.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${enrollmentStatus.className}`}
                      >
                        {enrollmentStatus.label}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${portalStatus.className}`}
                      >
                        {portalStatus.label}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">{portalStatus.detail}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          e.programType === "ADVANCED"
                            ? "bg-purple-50 text-purple-700"
                            : "bg-blue-50 text-blue-700"
                        }`}
                      >
                        {e.programType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{e.currentPhase?.label ?? "—"}</td>
                    <td className="px-6 py-4 text-gray-500">{e.assignedTo?.name ?? "Sem responsável"}</td>
                    <td className="px-6 py-4">
                      {e.status === "ACTIVE" ? (
                        <span
                          className={`text-xs font-semibold ${
                            daysInPhase > 14
                              ? "text-red-500"
                              : daysInPhase > 7
                              ? "text-amber-500"
                              : "text-gray-500"
                          }`}
                        >
                          {daysInPhase}d
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/ops/customers/${e.customer.id}`}
                        className="text-sm font-medium text-brand-verde hover:text-brand-tangerina transition-colors"
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
