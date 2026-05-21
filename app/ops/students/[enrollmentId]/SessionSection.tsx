"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { ClipboardList, Plus } from "lucide-react";
import {
  OPS_SESSION_TYPES,
  OPS_SESSION_TYPE_LABELS,
  type OpsSessionType,
} from "@/lib/ops/workflow";

type SessionItem = {
  id: string;
  sessionType: string;
  status?: string;
  sessionDate: string;
  rescheduleCount?: number;
  notes: string | null;
  conductor: { name: string };
};

const SESSION_TYPE_OPTIONS = OPS_SESSION_TYPES.map((value) => ({
  value,
  label: OPS_SESSION_TYPE_LABELS[value],
}));

function useSessionsPage(enrollmentId: string, page: number) {
  return useQuery<{ sessions: SessionItem[]; total: number; page: number; pageSize: number }>({
    queryKey: ["sessions", enrollmentId, page],
    queryFn: () =>
      fetch(`/api/ops/enrollments/${enrollmentId}/sessions?page=${page}`).then((r) => r.json()),
    enabled: page > 1, // page 1 comes from the profile fetch via props
  });
}

function useLogSession(enrollmentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      sessionType: string;
      conductorId: string;
      sessionDate: string;
      status: string;
      rescheduleCount?: number;
      notes?: string;
    }) =>
      fetch("/api/ops/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, ...body }),
      }).then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || "Erro ao registrar sessão");
        return r.json();
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sessions", enrollmentId] });
      qc.invalidateQueries({ queryKey: ["student-profile", enrollmentId] });
      toast.success("Sessão registrada com sucesso");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

function useOpsUsers() {
  return useQuery<{ users: { id: string; name: string }[] }>({
    queryKey: ["ops-users"],
    queryFn: () => fetch("/api/ops/users").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });
}

export function SessionSection({
  enrollmentId,
  initialSessions,
  totalSessions,
  currentUserId,
}: {
  enrollmentId: string;
  initialSessions: SessionItem[];
  totalSessions: number;
  currentUserId: string;
}) {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [formState, setFormState] = useState({
    sessionType: "",
    conductorId: currentUserId,
    sessionDate: new Date().toISOString().slice(0, 10),
    status: "REALIZADO",
    rescheduleCount: 0,
    notes: "",
  });

  const { data: pageData } = useSessionsPage(enrollmentId, page);
  const { data: usersData } = useOpsUsers();
  const logSession = useLogSession(enrollmentId);

  const sessions = page === 1 ? initialSessions : (pageData?.sessions ?? []);
  const total = pageData?.total ?? totalSessions;
  const PAGE_SIZE = 20;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.sessionType || !formState.conductorId || !formState.sessionDate) return;
    logSession.mutate(
      {
        sessionType: formState.sessionType,
        conductorId: formState.conductorId,
        sessionDate: formState.sessionDate,
        status: formState.status,
        rescheduleCount: formState.rescheduleCount,
        notes: formState.notes || undefined,
      },
      {
        onSuccess: () => {
          setFormState({
            sessionType: "",
            conductorId: currentUserId,
            sessionDate: new Date().toISOString().slice(0, 10),
            status: "REALIZADO",
            rescheduleCount: 0,
            notes: "",
          });
          setShowForm(false);
          setPage(1);
        },
      }
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-display font-semibold text-brand-verde flex items-center gap-2">
          <ClipboardList className="h-4 w-4" />
          Sessões
          <span className="text-xs font-normal text-gray-400">({total})</span>
        </h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-verde text-white text-xs font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="h-3.5 w-3.5" />
          Registrar Sessão
        </button>
      </div>

      {/* Inline log session form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-6 p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipo de Sessão</label>
              <select
                required
                value={formState.sessionType}
                onChange={(e) => setFormState((s) => ({ ...s, sessionType: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-verde/30"
              >
                <option value="">Selecionar...</option>
                {SESSION_TYPE_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Condutor</label>
              <select
                required
                value={formState.conductorId}
                onChange={(e) => setFormState((s) => ({ ...s, conductorId: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-verde/30"
              >
                {(usersData?.users ?? []).map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
              <input
                type="date"
                required
                value={formState.sessionDate}
                onChange={(e) => setFormState((s) => ({ ...s, sessionDate: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-verde/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select
                value={formState.status}
                onChange={(e) => setFormState((s) => ({ ...s, status: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-verde/30"
              >
                <option value="REALIZADO">Realizado</option>
                <option value="NO_SHOW">No show</option>
                <option value="REMARCADO">Remarcado</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Remarcações</label>
              <input
                type="number"
                min={0}
                value={formState.rescheduleCount}
                onChange={(e) => setFormState((s) => ({ ...s, rescheduleCount: Number(e.target.value) }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-verde/30"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Notas <span className="text-gray-400">(opcional)</span>
              </label>
              <input
                type="text"
                value={formState.notes}
                onChange={(e) => setFormState((s) => ({ ...s, notes: e.target.value }))}
                placeholder="Observações..."
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-brand-verde/30"
              />
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={logSession.isPending}
              className="px-4 py-1.5 rounded-lg bg-brand-verde text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50"
            >
              {logSession.isPending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      )}

      {/* Session list */}
      {sessions.length === 0 ? (
        <p className="text-sm text-gray-400">Nenhuma sessão registrada ainda.</p>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {sessions.map((s) => (
              <div key={s.id} className="py-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {OPS_SESSION_TYPE_LABELS[s.sessionType as OpsSessionType] ?? s.sessionType}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {format(new Date(s.sessionDate), "dd/MM/yyyy")} · {s.conductor.name}
                    {s.status ? ` · ${s.status.replace("_", " ")}` : ""}
                    {s.rescheduleCount ? ` · ${s.rescheduleCount} remarcação${s.rescheduleCount !== 1 ? "ões" : ""}` : ""}
                  </p>
                  {s.notes && <p className="text-xs text-gray-500 mt-1 italic">{s.notes}</p>}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-500">
                {page} / {totalPages}
              </span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50"
              >
                Próximo
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
