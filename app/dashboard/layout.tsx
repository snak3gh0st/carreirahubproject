import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfessionalSidebar } from "@/components/dashboard/professional-sidebar";

/**
 * Professional Dashboard Layout
 * 
 * Matches Pencil Design:
 * - Fixed 240px sidebar (left)
 * - Logo, navigation, user profile, Sigma footer
 * - Main content area (soft gray background)
 * - No top header
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
  const userName = (session.user as any).name || "User";
  const userEmail = (session.user as any).email || "";
  
  console.log("[DashboardLayout] User role:", userRole);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Professional Sidebar - Matches Pencil Design */}
      <ProfessionalSidebar 
        userRole={userRole}
        userName={userName}
        userEmail={userEmail}
      />

      {/* Main Content Area - 240px left padding for sidebar */}
      <main id="main-content" className="min-h-screen pl-60">
        {children}
      </main>
    </div>
  );
}
