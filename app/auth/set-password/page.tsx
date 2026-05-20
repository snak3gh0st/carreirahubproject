"use client";

import Link from "next/link";
import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { Logo } from "@/components/brand/Logo";
import { buildSafeCallbackUrl } from "@/lib/hub-links";

function SetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const callbackUrl = buildSafeCallbackUrl(searchParams.get("callbackUrl"));

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loginHref =
    callbackUrl !== "/dashboard"
      ? `/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`
      : "/auth/signin";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não coincidem.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Não foi possível redefinir a senha.");
        return;
      }

      const successHref =
        callbackUrl !== "/dashboard"
          ? `/auth/signin?reset=success&callbackUrl=${encodeURIComponent(callbackUrl)}`
          : "/auth/signin?reset=success";
      window.location.href = successHref;
    } catch {
      setError("Erro ao redefinir senha. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-brand-verde">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center max-w-sm">
          <p className="text-brand-verde mb-4">Link inválido ou expirado.</p>
          <Link href="/auth/reset-password" className="text-sm text-brand-verde hover:underline">
            Solicitar novo link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-verde">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <Logo className="w-16 h-16 mx-auto mb-5" />
          <h1 className="font-display text-3xl font-bold text-white">
            Carreira <span className="text-brand-tangerina">U.S.A.</span>
          </h1>
          <p className="text-white/60 text-sm mt-2">Crie sua nova senha</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-7">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-verde mb-1.5">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-brand-verde mb-1.5">
                Confirmar senha
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-center text-white font-semibold text-base transition disabled:opacity-60 bg-brand-tangerina hover:opacity-90"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href={loginHref} className="text-sm text-gray-500 hover:underline">
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brand-verde">
        <div className="text-white/60">Carregando...</div>
      </div>
    }>
      <SetPasswordForm />
    </Suspense>
  );
}
