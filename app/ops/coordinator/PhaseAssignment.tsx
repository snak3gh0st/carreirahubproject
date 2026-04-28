"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

interface OpsUser {
  id: string;
  name: string | null;
  role: string;
  assignedPhases: string[];
}

interface Phase {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
}

function useOpsUsers() {
  return useQuery<{ users: OpsUser[] }>({
    queryKey: ["coordinator-users"],
    queryFn: () => fetch("/api/ops/users?roles=ADMIN,OPERATIONAL").then((r) => r.json()),
  });
}

function usePhases() {
  return useQuery<{ phases: Phase[] }>({
    queryKey: ["all-phases"],
    queryFn: () => fetch("/api/ops/phases").then((r) => r.json()),
  });
}

function useUpdatePhases(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (assignedPhases: string[]) =>
      fetch(`/api/ops/coordinator/phases/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedPhases }),
      }).then((r) => { if (!r.ok) throw new Error("Failed"); return r.json(); }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coordinator-users"] }),
  });
}

function UserPhaseRow({ user, phases }: { user: OpsUser; phases: Phase[] }) {
  const [localPhases, setLocalPhases] = useState(user.assignedPhases);
  const update = useUpdatePhases(user.id);

  function toggle(phaseKey: string) {
    const next = localPhases.includes(phaseKey)
      ? localPhases.filter((k) => k !== phaseKey)
      : [...localPhases, phaseKey];
    setLocalPhases(next);
    update.mutate(next);
  }

  return (
    <div className="flex items-start gap-4 p-4 border-b border-gray-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-brand-tangerina/20 flex items-center justify-center text-brand-tangerina text-xs font-bold flex-shrink-0">
        {(user.name ?? "?").charAt(0).toUpperCase()}
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-900">{user.name ?? "Sem nome"}</p>
        <p className="text-xs text-gray-400 mb-2">{user.role}</p>
        <div className="flex flex-wrap gap-2">
          {phases.map((phase) => {
            const assigned = localPhases.includes(phase.key);
            return (
              <button
                key={phase.key}
                onClick={() => toggle(phase.key)}
                className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                  assigned
                    ? "bg-brand-verde text-white border-brand-verde"
                    : "bg-white text-gray-500 border-gray-200 hover:border-brand-verde"
                }`}
              >
                {phase.label}
              </button>
            );
          })}
        </div>
      </div>
      {update.isPending && <Loader2 className="h-4 w-4 animate-spin text-brand-verde flex-shrink-0 mt-1" />}
    </div>
  );
}

export function PhaseAssignment() {
  const { data: usersData, isLoading: loadingUsers } = useOpsUsers();
  const { data: phasesData, isLoading: loadingPhases } = usePhases();

  if (loadingUsers || loadingPhases) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-verde" />
      </div>
    );
  }

  const users = usersData?.users ?? [];
  const phases = (phasesData?.phases ?? []).sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50">
        <h2 className="text-sm font-display font-semibold text-gray-500 uppercase tracking-wide">
          Atribuição de Fases por Membro
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Clique nas fases para atribuir ou remover responsabilidade
        </p>
      </div>
      <div>
        {users.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Nenhum usuário operacional encontrado</p>
        ) : (
          users.map((user) => (
            <UserPhaseRow key={user.id} user={user} phases={phases} />
          ))
        )}
      </div>
    </div>
  );
}
