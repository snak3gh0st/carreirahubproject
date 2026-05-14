"use client";

import { useMemo, useState } from "react";
import { Loader2, Mail, Search, UserPlus, UsersRound } from "lucide-react";
import { toast } from "sonner";

type OpsUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
  assignedPhases?: string[];
};

export function OpsTeamClient({ initialUsers }: { initialUsers: OpsUser[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) =>
      [user.name ?? "", user.email].some((value) => value.toLowerCase().includes(query))
    );
  }, [search, users]);

  async function refresh() {
    const res = await fetch("/api/dashboard/team?roles=HEAD_OPERACIONAL,OPERATIONAL");
    if (!res.ok) return;
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  async function createUser(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/dashboard/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role: "OPERATIONAL" }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao criar operacional");
        return;
      }
      toast.success("Operacional criado e convite enviado");
      setName("");
      setEmail("");
      await refresh();
    } catch {
      toast.error("Erro de rede ao criar operacional");
    } finally {
      setLoading(false);
    }
  }

  async function setActive(user: OpsUser, active: boolean) {
    setActionId(user.id);
    try {
      const res = await fetch(`/api/dashboard/team/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao atualizar usuario");
        return;
      }
      setUsers((current) => current.map((item) => item.id === user.id ? { ...item, active } : item));
      toast.success(active ? "Operacional reativado" : "Operacional desativado");
    } catch {
      toast.error("Erro de rede ao atualizar usuario");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-verde/10 text-brand-verde">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-base font-bold text-gray-900">Adicionar operacional</h2>
            <p className="text-xs text-gray-400">Cria login e envia senha temporaria por email.</p>
          </div>
        </div>

        <form onSubmit={createUser} className="space-y-4">
          <div>
            <label htmlFor="ops-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Nome
            </label>
            <input
              id="ops-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Fraenze Operacional"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
              required
            />
          </div>
          <div>
            <label htmlFor="ops-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Email
            </label>
            <input
              id="ops-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operacional@carreirausa.com"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-verde px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            Criar e enviar convite
          </button>
        </form>

        <div className="mt-5 rounded-lg bg-gray-50 p-3 text-xs leading-relaxed text-gray-500">
          Depois de criar, defina as fases desta pessoa na seção de atribuição abaixo.
        </div>
      </section>

      <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-50 p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-creme text-brand-verde">
                <UsersRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-base font-bold text-gray-900">Time operacional</h2>
                <p className="text-xs text-gray-400">
                  {users.length} {users.length === 1 ? "usuario operacional" : "usuarios operacionais"}
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar no time..."
                className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-brand-verde focus:bg-white"
              />
            </div>
          </div>
        </div>

        <div className="divide-y divide-gray-50">
          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">Nenhum operacional encontrado.</div>
          ) : (
            filteredUsers.map((user) => (
              <div key={user.id} className={`flex items-center gap-4 p-5 ${!user.active ? "opacity-60" : ""}`}>
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-800 text-xs font-bold text-white">
                  {(user.name ?? user.email).slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-gray-900">{user.name ?? "Sem nome"}</p>
                  <p className="truncate text-xs text-gray-400">{user.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(user.assignedPhases ?? []).length === 0 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Sem fases</span>
                    ) : (
                      user.assignedPhases?.map((phase) => (
                        <span key={phase} className="rounded-full bg-brand-verde/10 px-2 py-0.5 text-[10px] font-bold text-brand-verde">
                          {phase}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"}`}>
                    {user.active ? "Ativo" : "Inativo"}
                  </span>
                  <button
                    type="button"
                    onClick={() => void setActive(user, !user.active)}
                    disabled={actionId === user.id}
                    className="text-xs font-semibold text-brand-verde hover:text-brand-tangerina disabled:opacity-50"
                  >
                    {actionId === user.id ? "..." : user.active ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
