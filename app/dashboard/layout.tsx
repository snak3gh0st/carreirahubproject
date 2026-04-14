import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ProfessionalSidebar } from "@/components/dashboard/professional-sidebar";
import { SupportChatBubble } from "@/components/support/support-chat-bubble";
import { ChatBubble } from "@/components/ai/ChatBubble";

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
  const userId = (session.user as any).id;
  const userName = (session.user as any).name || "User";
  const userEmail = (session.user as any).email || "";
  const isTeamRole = ["ADMIN", "SUPPORT", "OPERATIONAL", "SALES", "SDR", "FINANCE"].includes(userRole);
  
  console.log("[DashboardLayout] User role:", userRole);

  return (
    <div data-portal="dashboard" className="min-h-screen bg-gray-50">
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

      {/* Support Chat Bubble - only for non-team users */}
      {!isTeamRole && (
        <SupportChatBubble userId={userId} userName={userName} />
      )}

      {/* CarreiraUSA AI Copilot — team operators only */}
      {isTeamRole && <ChatBubble />}
    </div>
  );
}
