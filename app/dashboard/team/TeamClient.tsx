// app/dashboard/team/TeamClient.tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserSheet } from "./UserSheet";
import { UserPlus, Search } from "lucide-react";

type TeamUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-yellow-100 text-yellow-800",
  SALES: "bg-blue-100 text-blue-800",
  SDR: "bg-purple-100 text-purple-800",
  FINANCE: "bg-green-100 text-green-800",
  SUPPORT: "bg-orange-100 text-orange-800",
  OPERATIONAL: "bg-gray-100 text-gray-800",
  COMMERCIAL: "bg-indigo-100 text-indigo-800",
};

const ALL_ROLES = ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL", "COMMERCIAL"];

export function TeamClient({ initialUsers, currentUserId }: { initialUsers: TeamUser[]; currentUserId: string }) {
  const [users, setUsers] = useState<TeamUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editUser, setEditUser] = useState<TeamUser | undefined>(undefined);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (roleFilter) params.set("role", roleFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/dashboard/team?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    }
  }, [search, roleFilter, statusFilter]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchSearch =
        !search ||
        u.name?.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase());
      const matchRole = !roleFilter || u.role === roleFilter;
      const matchStatus =
        !statusFilter ||
        (statusFilter === "active" && u.active) ||
        (statusFilter === "inactive" && !u.active);
      return matchSearch && matchRole && matchStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const handleDeactivate = async (user: TeamUser) => {
    setActionLoading(user.id);
    setActionError(null);
    const res = await fetch(`/api/dashboard/team/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: false }),
    });
    setActionLoading(null);
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, active: false } : u));
    } else {
      const data = await res.json();
      setActionError(data.error ?? "Erro ao desativar.");
    }
  };

  const handleReactivate = async (user: TeamUser) => {
    setActionLoading(user.id);
    setActionError(null);
    const res = await fetch(`/api/dashboard/team/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    setActionLoading(null);
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.id === user.id ? { ...u, active: true } : u));
    } else {
      const data = await res.json();
      setActionError(data.error ?? "Erro ao reativar.");
    }
  };

  const handleDelete = async (user: TeamUser) => {
    if (!confirm(`Excluir permanentemente ${user.name ?? user.email}? Esta ação não pode ser desfeita.`)) return;
    setActionLoading(user.id);
    setActionError(null);
    const res = await fetch(`/api/dashboard/team/${user.id}`, { method: "DELETE" });
    setActionLoading(null);
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } else {
      const data = await res.json();
      setActionError(data.error ?? "Erro ao excluir.");
    }
  };

  const openCreate = () => {
    setEditUser(undefined);
    setSheetOpen(true);
  };

  const openEdit = (user: TeamUser) => {
    setEditUser(user);
    setSheetOpen(true);
  };

  const getInitials = (name: string | null, email: string) => {
    if (!name) return email.slice(0, 2).toUpperCase();
    const parts = name.split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const avatarColor = (role: string) => {
    const map: Record<string, string> = {
      ADMIN: "bg-yellow-600",
      SALES: "bg-blue-600",
      SDR: "bg-purple-600",
      FINANCE: "bg-green-600",
      SUPPORT: "bg-orange-600",
      OPERATIONAL: "bg-gray-600",
      COMMERCIAL: "bg-indigo-600",
    };
    return map[role] ?? "bg-gray-500";
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Equipe</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie usuários e permissões de acesso</p>
        </div>
        <Button onClick={openCreate} className="bg-brand-verde hover:bg-brand-verde/90 text-white gap-2">
          <UserPlus className="w-4 h-4" />
          Novo Usuário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="">Todos os roles</option>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-700 bg-white"
        >
          <option value="">Todos os status</option>
          <option value="active">Ativo</option>
          <option value="inactive">Inativo</option>
        </select>
      </div>

      {actionError && (
        <p className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{actionError}</p>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Usuário</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Criado em</th>
              <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-12 text-gray-400">Nenhum usuário encontrado.</td>
              </tr>
            )}
            {filteredUsers.map((user) => {
              const isSelf = user.id === currentUserId;
              const isLoading = actionLoading === user.id;
              return (
                <tr key={user.id} className={`hover:bg-gray-50 ${!user.active ? "opacity-60" : ""}`}>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full ${avatarColor(user.role)} text-white flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                        {getInitials(user.name, user.email)}
                      </div>
                      <div>
                        <div className="font-semibold text-gray-900">{user.name ?? "—"}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.active ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />Inativo
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {isSelf ? (
                        <span className="text-xs text-gray-400 italic">— você mesmo —</span>
                      ) : user.active ? (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEdit(user)} disabled={isLoading}>
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleDeactivate(user)}
                            disabled={isLoading}
                          >
                            {isLoading ? "..." : "Desativar"}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="sm" variant="outline" onClick={() => handleReactivate(user)} disabled={isLoading}>
                            {isLoading ? "..." : "Reativar"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-200 text-red-600 hover:bg-red-50"
                            onClick={() => handleDelete(user)}
                            disabled={isLoading}
                          >
                            {isLoading ? "..." : "Excluir"}
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <UserSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        user={editUser}
        onSuccess={refresh}
      />
    </div>
  );
}
