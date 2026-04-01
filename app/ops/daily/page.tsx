import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { CheckCircle2, ChevronRight } from "lucide-react";
import type { FlagType } from "@/lib/constants/sla";

interface Flag {
  type: FlagType;
  daysRemaining?: number;
  daysSinceSession?: number;
}

interface FlaggedStudent {
  enrollmentId: string;
  studentName: string;
  customerId: string;
  phaseLabel: string;
  assigneeName: string;
  flags: Flag[];
}

interface DailyResponse {
  students: FlaggedStudent[];
  count: number;
}

export default async function DailyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const userName = (session.user as any).name || "User";
  const nextAuthUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";

  let data: DailyResponse = { students: [], count: 0 };
  try {
    const cookieStore = await cookies();
    const res = await fetch(`${nextAuthUrl}/api/ops/daily`, {
      headers: { cookie: cookieStore.toString() },
      cache: "no-store",
    });
    if (res.ok) {
      data = await res.json();
    }
  } catch {
    // Fallback to empty state on error
  }

  const { students, count } = data;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-display font-bold text-brand-verde">
        Ações do Dia
      </h1>
      <p className="text-gray-500 text-sm mt-1">Bem-vindo, {userName}</p>

      <div className="mt-6">
        {count === 0 ? (
          <div className="bg-green-50 rounded-2xl border border-green-200 p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-green-600 mx-auto mb-3" />
            <h2 className="text-lg font-display font-semibold text-green-700">
              Tudo certo hoje!
            </h2>
            <p className="text-sm text-green-600">
              Nenhum aluno precisa de atenção no momento.
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6">
              <p className="text-3xl font-bold text-brand-verde">{count}</p>
              <p className="text-sm text-gray-500 mt-1">
                {count === 1
                  ? "1 aluno precisa de atenção"
                  : `${count} aluno(s) precisa(m) de atenção`}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
              {students.map((student) => {
                const slaFlag = student.flags.find((f) => f.type === "sla_expiring");
                const sessionFlag = student.flags.find(
                  (f) => f.type === "no_recent_session"
                );

                return (
                  <div
                    key={student.enrollmentId}
                    className="px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                  >
                    {/* Flag badges */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      {slaFlag && (
                        <span className="text-[10px] font-bold bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          SLA
                        </span>
                      )}
                      {sessionFlag && (
                        <span className="text-[10px] font-bold bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                          Sem sessão
                        </span>
                      )}
                    </div>

                    {/* Student info */}
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/ops/students/${student.enrollmentId}`}
                        className="font-semibold text-sm text-gray-900 hover:text-brand-verde transition-colors"
                      >
                        {student.studentName}
                      </Link>
                      <p className="text-xs text-gray-500">{student.phaseLabel}</p>
                    </div>

                    {/* Days info */}
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      {slaFlag && (
                        <span
                          className={`text-[11px] font-mono font-medium ${
                            (slaFlag.daysRemaining ?? 0) < 0
                              ? "text-red-500"
                              : "text-red-500"
                          }`}
                        >
                          {(slaFlag.daysRemaining ?? 0) < 0
                            ? `${Math.abs(slaFlag.daysRemaining!)}d atrasado`
                            : `${slaFlag.daysRemaining}d restantes`}
                        </span>
                      )}
                      {sessionFlag && sessionFlag.daysSinceSession !== undefined && (
                        <span className="text-[11px] font-mono font-medium text-amber-600">
                          Última sessão há {sessionFlag.daysSinceSession}d
                        </span>
                      )}
                      {sessionFlag && sessionFlag.daysSinceSession === undefined && (
                        <span className="text-[11px] font-mono font-medium text-amber-600">
                          Sem sessão registrada
                        </span>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-gray-300 hover:text-brand-verde flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
