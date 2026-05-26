import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isOperationalAccessRole } from "@/lib/roles";
import { OpsAiPageClient } from "./OpsAiPageClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operacional AI | Ops Hub" };

export default async function OpsAiPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const role = (session.user as { role?: string }).role;
  if (!isOperationalAccessRole(role)) redirect("/ops");

  return <OpsAiPageClient />;
}
