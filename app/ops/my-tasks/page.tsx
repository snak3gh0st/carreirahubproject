// app/ops/my-tasks/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CheckSquare } from "lucide-react";
import { MyTasksClient } from "./MyTasksClient";

export const dynamic = "force-dynamic";

export default async function MyTasksPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/ops/login");

  const userRole = (session.user as any).role;
  if (!["ADMIN", "OPERATIONAL"].includes(userRole)) redirect("/ops");

  const userName = (session.user as any).name?.split(" ")[0] || "User";

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <CheckSquare className="h-7 w-7 text-brand-verde" />
          <h1 className="text-3xl font-display font-bold text-brand-verde tracking-tight">
            Minhas Tarefas
          </h1>
        </div>
        <p className="text-gray-500 text-sm">
          Alunos sob sua responsabilidade · {userName}
        </p>
      </div>

      <MyTasksClient />
    </div>
  );
}
