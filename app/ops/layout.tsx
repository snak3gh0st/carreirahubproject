import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OpsSidebar } from "@/components/ops/ops-sidebar";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("[OpsLayout] Session error:", error);
    redirect("/ops/login");
  }

  if (!session) {
    redirect("/ops/login");
  }

  const userRole = (session.user as any).role;
  const userName = (session.user as any).name || "User";
  const userEmail = (session.user as any).email || "";

  // Double-check role at layout level (middleware also checks)
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) {
    redirect("/");
  }

  return (
    <div data-portal="ops" className="min-h-screen bg-gray-50">
      <OpsSidebar userName={userName} userEmail={userEmail} userRole={userRole} />
      <main id="main-content" className="min-h-screen pl-60">
        {children}
      </main>
    </div>
  );
}
