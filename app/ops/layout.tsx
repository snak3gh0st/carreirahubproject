import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OpsSidebar } from "@/components/ops/ops-sidebar";
import { OpsQueryProvider } from "./OpsQueryProvider";
import { isOperationalAccessRole } from "@/lib/roles";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  // No session → middleware already redirects to /ops/login except for the login page itself.
  // Render children without sidebar so the login page renders correctly.
  if (!session) {
    return <>{children}</>;
  }

  const userRole = (session.user as any).role;
  const userName = (session.user as any).name || "User";
  const userEmail = (session.user as any).email || "";

  if (!isOperationalAccessRole(userRole)) {
    redirect("/?error=access_denied");
  }

  return (
    <div data-portal="ops" className="min-h-screen bg-gray-50">
      <OpsSidebar userName={userName} userEmail={userEmail} userRole={userRole} />
      <main id="main-content" className="min-h-screen pl-60">
        <OpsQueryProvider>{children}</OpsQueryProvider>
      </main>
    </div>
  );
}
