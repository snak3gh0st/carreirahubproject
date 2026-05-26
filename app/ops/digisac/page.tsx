import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { MessageSquareText } from "lucide-react";

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
    <div className="mx-auto max-w-[1500px] space-y-6 px-4 py-5 sm:px-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-verde text-white shadow-sm">
              <MessageSquareText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Ops Hub</p>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-950 sm:text-3xl">
                Conversas Digisac
              </h1>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-relaxed text-gray-600">
            Caixa de entrada operacional para falar com clientes, revisar respostas recentes e voltar para a ficha quando o atendimento exigir contexto.
          </p>
        </div>
      </div>

      <OpsDigisacInbox initialThreadId={searchParams.thread} />
    </div>
  );
}
