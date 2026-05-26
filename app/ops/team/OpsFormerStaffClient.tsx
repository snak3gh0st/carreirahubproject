"use client";

import { useMemo, useState } from "react";
import { BriefcaseBusiness, Loader2, Search, UserMinus } from "lucide-react";
import { toast } from "sonner";

type PhaseOption = {
  key: string;
  label: string;
};

type FormerStaffMember = {
  id: string;
  name: string;
  email: string | null;
  status: string;
  areas: string[];
  notes: string | null;
  createdAt: string;
};

function formatFormerStaffLabel(staff: Pick<FormerStaffMember, "name" | "status">) {
  return staff.status === "FORMER" ? `${staff.name} (ex-funcionário)` : staff.name;
}

export function OpsFormerStaffClient({
  initialStaffMembers,
  phaseOptions,
}: {
  initialStaffMembers: FormerStaffMember[];
  phaseOptions: PhaseOption[];
}) {
  const [staffMembers, setStaffMembers] = useState(initialStaffMembers);
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const phaseLabelByKey = useMemo(
    () => new Map(phaseOptions.map((phase) => [phase.key, phase.label])),
    [phaseOptions]
  );

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return staffMembers;
    return staffMembers.filter((staff) =>
      [staff.name, staff.email ?? "", staff.notes ?? ""].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [search, staffMembers]);

  function toggleArea(areaKey: string) {
    setAreas((current) =>
      current.includes(areaKey)
        ? current.filter((key) => key !== areaKey)
        : [...current, areaKey]
    );
  }

  async function createFormerStaff(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/ops/staff-members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          status: "FORMER",
          areas,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao cadastrar ex-funcionário");
        return;
      }
      setStaffMembers((current) => [data.staffMember, ...current]);
      setName("");
      setEmail("");
      setNotes("");
      setAreas([]);
      toast.success("Ex-funcionário cadastrado para controle interno");
    } catch {
      toast.error("Erro de rede ao cadastrar ex-funcionário");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white shadow-sm">
      <div className="border-b border-gray-50 p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600">
              <UserMinus className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-gray-900">Ex-funcionários</h2>
              <p className="text-xs text-gray-400">
                Cadastro interno para selecionar quem atuou, sem login e sem convite.
              </p>
            </div>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar ex-funcionário..."
              className="h-10 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm outline-none focus:border-brand-verde focus:bg-white"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[380px_minmax(0,1fr)]">
        <form onSubmit={createFormerStaff} className="space-y-4 border-b border-gray-50 p-5 lg:border-b-0 lg:border-r">
          <div>
            <label htmlFor="former-staff-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Nome
            </label>
            <input
              id="former-staff-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nome do ex-funcionário"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
              required
            />
          </div>
          <div>
            <label htmlFor="former-staff-email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Email opcional
            </label>
            <input
              id="former-staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="opcional@carreirausa.com"
              className="h-10 w-full rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
            />
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Áreas</p>
            <div className="flex flex-wrap gap-2">
              {phaseOptions.map((phase) => {
                const selected = areas.includes(phase.key);
                return (
                  <button
                    key={phase.key}
                    type="button"
                    onClick={() => toggleArea(phase.key)}
                    className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                      selected
                        ? "border-brand-verde bg-brand-verde text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:border-brand-verde"
                    }`}
                  >
                    {phase.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label htmlFor="former-staff-notes" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
              Observação
            </label>
            <textarea
              id="former-staff-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              placeholder="Ex.: atuou em Raio X e entrevistas em 2025."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-verde focus:ring-2 focus:ring-brand-verde/10"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-brand-verde px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            Cadastrar ex-funcionário
          </button>
        </form>

        <div className="divide-y divide-gray-50">
          {filteredStaff.length === 0 ? (
            <div className="p-12 text-center text-sm text-gray-400">
              Nenhum ex-funcionário cadastrado.
            </div>
          ) : (
            filteredStaff.map((staff) => (
              <div key={staff.id} className="flex items-start gap-4 p-5">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gray-800 text-xs font-bold text-white">
                  {staff.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold text-gray-900">
                    {formatFormerStaffLabel(staff)}
                  </p>
                  {staff.email && <p className="break-all text-xs text-gray-400">{staff.email}</p>}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {staff.areas.length === 0 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Sem áreas</span>
                    ) : (
                      staff.areas.map((area) => (
                        <span key={area} className="inline-flex items-center gap-1 rounded-full bg-brand-verde/10 px-2 py-0.5 text-[10px] font-bold text-brand-verde">
                          <BriefcaseBusiness className="h-3 w-3" />
                          {phaseLabelByKey.get(area) ?? area}
                        </span>
                      ))
                    )}
                  </div>
                  {staff.notes && <p className="mt-2 break-words text-xs text-gray-500">{staff.notes}</p>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
