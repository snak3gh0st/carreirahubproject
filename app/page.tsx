import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";
import { PortalCard } from "@/components/portal-selector/portal-card";
import { AccessDeniedBanner } from "@/components/portal-selector/access-denied-banner";
import { Users, DollarSign, ClipboardCheck } from "lucide-react";

export default async function PortalSelectorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getServerSession(authOptions);
  const userRole = session ? (session.user as any).role : null;

  return (
    <div className="min-h-screen bg-brand-creme flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="text-center mb-12">
        <Logo className="w-16 h-16 mx-auto mb-4" />
        <h1 className="font-display text-3xl font-bold text-brand-verde">
          Carreira <span className="text-brand-tangerina">U.S.A.</span>
        </h1>
        <p className="text-brand-verde/60 text-sm mt-2">
          Selecione seu portal
        </p>
      </div>

      {/* Access denied banner */}
      {searchParams?.error === "access_denied" && <AccessDeniedBanner />}

      {/* Portal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full">
        <PortalCard
          title="Hub Comercial"
          description="Vendas, leads e gestao de clientes"
          href={session ? "/dashboard" : "/auth/signin"}
          icon={<Users className="h-7 w-7" />}
        />
        <PortalCard
          title="Hub Financeiro"
          description="Invoices, pagamentos e acompanhamento"
          href={session ? "/dashboard" : "/auth/signin"}
          icon={<DollarSign className="h-7 w-7" />}
        />
        <PortalCard
          title="Hub Operacional"
          description="Onboarding, formularios e entregas"
          href={session && (userRole === "OPERATIONAL" || userRole === "ADMIN") ? "/ops" : "/ops/login"}
          icon={<ClipboardCheck className="h-7 w-7" />}
        />
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-brand-verde/30 mt-12">
        Powered by SIGMA INTEL
      </p>
    </div>
  );
}
