"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ALL_ROLES = ["SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL", "COMMERCIAL", "ADMIN"] as const;

type TeamUser = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
};

interface UserSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: TeamUser;
  onSuccess: () => void;
}

export function UserSheet({ open, onOpenChange, user, onSuccess }: UserSheetProps) {
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState(user?.role ?? "SALES");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName(user?.name ?? "");
      setEmail(user?.email ?? "");
      setRole(user?.role ?? "SALES");
      setError(null);
    }
  }, [open, user]);

  const handleOpenChange = (val: boolean) => {
    onOpenChange(val);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = isEdit ? `/api/dashboard/team/${user!.id}` : "/api/dashboard/team";
      const method = isEdit ? "PATCH" : "POST";
      const body = isEdit
        ? { name, role }
        : { name, email, role };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar.");
        return;
      }

      onOpenChange(false);
      onSuccess();
    } catch {
      setError("Erro de rede. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEdit ? "Editar Usuário" : "Novo Usuário"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Altere o nome ou o role do usuário."
              : "Uma senha temporária será enviada por email."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ana Ferreira"
              required
            />
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ana@carreirausa.com"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALL_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-brand-verde hover:bg-brand-verde/90" disabled={loading}>
              {loading ? "Salvando..." : isEdit ? "Salvar Alterações" : "Criar & Enviar Convite"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
