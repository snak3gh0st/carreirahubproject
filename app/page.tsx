import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/brand/Logo";
import { PortalCard } from "@/components/portal-selector/portal-card";
import { AccessDeniedBanner } from "@/components/portal-selector/access-denied-banner";
import { Users, DollarSign, ClipboardCheck, ShieldCheck, LineChart, UserRound } from "lucide-react";
import { HUB_LINKS } from "@/lib/hub-links";
import { isOperationalAccessRole } from "@/lib/roles";

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
    case "HEAD_OPERACIONAL":
      redirect("/ops");
      break;
    // ADMIN, EXECUTIVE, anything else: fall through to render the multi-card portal
  }

  const isAdmin = userRole === "ADMIN";
  const showExecutive = isAdmin || userRole === "EXECUTIVE";
  const showClientHub = isAdmin;
  const visibleCardCount =
    3 + (isAdmin ? 1 : 0) + (showExecutive ? 1 : 0) + (showClientHub ? 1 : 0);
  const gridColsClass =
    visibleCardCount >= 6
      ? "sm:grid-cols-2 lg:grid-cols-3 max-w-5xl"
      : visibleCardCount === 4
        ? "sm:grid-cols-2 lg:grid-cols-4 max-w-6xl"
        : "sm:grid-cols-2 lg:grid-cols-3 max-w-4xl";

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
      <div className={`grid w-full auto-rows-fr grid-cols-1 items-stretch gap-5 ${gridColsClass}`}>
        <PortalCard
          title="Hub Comercial"
          description="Vendas, leads e gestao de clientes"
          href={HUB_LINKS.comercial.path}
          icon={<Users className="h-7 w-7" />}
        />
        <PortalCard
          title="Hub Financeiro"
          description="Invoices, pagamentos e acompanhamento"
          href={HUB_LINKS.financeiro.path}
          icon={<DollarSign className="h-7 w-7" />}
        />
        <PortalCard
          title="Hub Operacional"
          description="Onboarding, formularios e entregas"
          href={isOperationalAccessRole(userRole) ? HUB_LINKS.operacional.path : "/ops/login"}
          icon={<ClipboardCheck className="h-7 w-7" />}
        />
        {isAdmin && (
          <PortalCard
            title="Hub Admin"
            description="Visao consolidada e configuracoes"
            href={HUB_LINKS.admin.path}
            icon={<ShieldCheck className="h-7 w-7" />}
          />
        )}
        {showExecutive && (
          <PortalCard
            title="Hub Executivo"
            description="Visao executiva e indicadores (CEO)"
            href={HUB_LINKS.executivo.path}
            icon={<LineChart className="h-7 w-7" />}
          />
        )}
        {showClientHub && (
          <PortalCard
            title="Hub do Cliente"
            description="Portal dedicado de alunos e pagamentos"
            href={HUB_LINKS.cliente.path}
            icon={<UserRound className="h-7 w-7" />}
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
