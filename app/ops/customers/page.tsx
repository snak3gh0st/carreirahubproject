import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function OpsCustomersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const enrollments = await prisma.mentorshipEnrollment.findMany({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      currentPhase: { select: { label: true } },
      assignedTo: { select: { name: true } },
      transitions: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    },
  });

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">Clientes</h1>
        <p className="text-gray-500 text-sm mt-1">{enrollments.length} aluno{enrollments.length !== 1 ? "s" : ""} ativo{enrollments.length !== 1 ? "s" : ""}</p>
      </div>

      {enrollments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
          <p className="text-sm text-gray-400">Nenhum aluno ativo no momento.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Aluno</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Programa</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Fase Atual</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Responsável</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Dias na Fase</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {enrollments.map((e) => {
                const lastTransition = e.transitions[0];
                const since = lastTransition
                  ? new Date(lastTransition.createdAt).getTime()
                  : new Date(e.startDate).getTime();
                const daysInPhase = Math.floor((Date.now() - since) / 86_400_000);

                return (
                  <tr key={e.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{e.customer.name}</p>
                      <p className="text-xs text-gray-400">{e.customer.email}</p>
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
                    <td className="px-6 py-4 text-gray-500">{e.assignedTo.name}</td>
                    <td className="px-6 py-4">
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
