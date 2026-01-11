import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SkipToContent } from "@/components/skip-to-content";

/**
 * Layout compartilhado para todas as páginas do dashboard
 *
 * Fornece navegação consistente e header com suporte mobile
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/auth/signin");
  }

  const userRole = (session.user as any).role;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <SkipToContent />
      <DashboardHeader session={session} userRole={userRole} />

      {/* Conteúdo */}
      <main id="main-content" className="min-h-screen">
        {children}
      </main>
    </div>
  );
}
