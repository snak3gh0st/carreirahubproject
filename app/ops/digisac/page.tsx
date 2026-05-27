import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { OpsDigisacInbox } from "@/components/ops/digisac/OpsDigisacInbox";
import { authOptions } from "@/lib/auth";
import { isOperationalAccessRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const metadata = { title: "Conversas Digisac | Ops Hub" };

export default async function OpsDigisacPage({
  searchParams,
}: {
  searchParams: { thread?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const role = (session.user as { role?: string }).role;
  if (!isOperationalAccessRole(role)) redirect("/ops");

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 pb-12 pt-8 md:px-8 md:pt-10">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">
          Atendimento
        </p>
        <h1 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight text-gray-900 md:text-[32px]">
          Conversas
        </h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-gray-600">
          Caixa de entrada do Digisac. Responda direto daqui ou abra a ficha do aluno quando precisar de contexto.
        </p>
      </header>

      <OpsDigisacInbox initialThreadId={searchParams.thread} />
    </div>
  );
}
