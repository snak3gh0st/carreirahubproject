import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StudentProfileClient } from "./StudentProfileClient";
import { isOperationalAccessRole } from "@/lib/roles";

export default async function StudentProfilePage({
  params,
}: {
  params: { enrollmentId: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/ops/login");

  const userRole = (session.user as any).role as string;
  if (!isOperationalAccessRole(userRole)) redirect("/ops");

  const currentUserId = (session.user as any).id as string;

  return (
    <Suspense fallback={<div className="p-8 text-sm text-gray-400">Carregando...</div>}>
      <StudentProfileClient
        enrollmentId={params.enrollmentId}
        currentUserId={currentUserId}
      />
    </Suspense>
  );
}
