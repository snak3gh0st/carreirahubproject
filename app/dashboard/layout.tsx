import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
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
  let session;
  try {
    console.log("[DashboardLayout] Getting session...");
    session = await getServerSession(authOptions);
    console.log("[DashboardLayout] Session retrieved successfully");
  } catch (error) {
    console.error("[DashboardLayout] Session error:", {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Redirect to signin on session error instead of 500
    redirect("/auth/signin");
  }

  if (!session) {
    console.log("[DashboardLayout] No session found, redirecting to signin");
    redirect("/auth/signin");
  }

  const userRole = (session.user as any).role;
  console.log("[DashboardLayout] User role:", userRole);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <SkipToContent />
      <DashboardHeader session={session} userRole={userRole} />

      {/* Sidebar Navigation - Desktop Only */}
      <SidebarNav userRole={userRole} />

      {/* Conteúdo com margem para sidebar */}
      <main id="main-content" className="min-h-screen lg:pl-64 transition-all duration-300">
        {children}
      </main>
    </div>
  );
}
