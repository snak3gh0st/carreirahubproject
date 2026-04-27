import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { OpsSidebar } from "@/components/ops/ops-sidebar";

export default async function OpsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = await headers();
  const pathname = headersList.get("x-next-url") || headersList.get("x-invoke-path") || "";
  const isLoginPage = pathname.includes("/ops/login");

  let session;
  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error("[OpsLayout] Session error:", error);
    if (!isLoginPage) redirect("/ops/login");
  }

  if (!session) {
    if (isLoginPage) {
      return <>{children}</>;
    }
    redirect("/ops/login");
  }

  const userRole = (session.user as any).role;
  const userName = (session.user as any).name || "User";
  const userEmail = (session.user as any).email || "";

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
