import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ClipboardCheck } from "lucide-react";

export default async function OpsHomePage() {
  const session = await getServerSession(authOptions);
  const userName = (session?.user as any)?.name || "User";

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-brand-verde">
          Hub Operacional
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Bem-vindo, {userName}
        </p>
      </div>

      {/* Placeholder content */}
      <div className="flex flex-col items-center justify-center py-20 px-8 bg-white rounded-2xl border border-gray-200">
        <ClipboardCheck className="h-12 w-12 text-brand-verde/30 mb-4" />
        <h2 className="text-lg font-display font-semibold text-brand-verde mb-2">
          Em construcao
        </h2>
        <p className="text-sm text-gray-400 text-center max-w-md">
          O Hub Operacional esta sendo configurado. As funcionalidades de
          onboarding, formularios e entregas serao adicionadas em breve.
        </p>
      </div>
    </div>
  );
}
