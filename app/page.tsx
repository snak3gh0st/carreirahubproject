import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";
import { PortalCard } from "@/components/portal-selector/portal-card";
import { AccessDeniedBanner } from "@/components/portal-selector/access-denied-banner";
import { Users, DollarSign, ClipboardCheck, ShieldCheck, LineChart } from "lucide-react";

export default async function PortalSelectorPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const session = await getServerSession(authOptions);

  // ISS-002: gate portal selector by auth + redirect single-hub roles to their hub.
  // Phase 20 D-03 ("no cross-hub visibility for non-ADMIN") now extends to the portal entry.
  if (!session) {
    redirect("/auth/signin");
  }

  const userRole = (session!.user as any).role;
  switch (userRole) {
    case "HEAD_COMERCIAL":
    case "COMMERCIAL":
    case "FINANCE":
      redirect("/dashboard");
      break;
    case "OPERATIONAL":
      redirect("/ops");
      break;
    // ADMIN, EXECUTIVE, anything else: fall through to render the multi-card portal
  }

  const isAdmin = userRole === "ADMIN";
  const showExecutive = isAdmin || userRole === "EXECUTIVE";
  const extraCards = (isAdmin ? 1 : 0) + (showExecutive ? 1 : 0);
  const gridColsClass =
    extraCards === 2
      ? "md:grid-cols-5 max-w-6xl"
      : extraCards === 1
        ? "md:grid-cols-4 max-w-5xl"
        : "md:grid-cols-3 max-w-3xl";

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
      <div className={`grid grid-cols-1 ${gridColsClass} gap-6 w-full`}>
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
        {isAdmin && (
          <PortalCard
            title="Hub Admin"
            description="Visao consolidada e configuracoes"
            href="/dashboard"
            icon={<ShieldCheck className="h-7 w-7" />}
          />
        )}
        {showExecutive && (
          <PortalCard
            title="Hub Executivo"
            description="Visao executiva e indicadores (CEO)"
            href="/dashboard/executive"
            icon={<LineChart className="h-7 w-7" />}
          />
        )}
      </div>

      {/* Footer */}
      <p className="text-center text-xs text-brand-verde/30 mt-12">
        Powered by SIGMA INTEL
      </p>
    </div>
  );
}
