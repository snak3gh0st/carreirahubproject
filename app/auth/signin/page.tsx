"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { Logo } from "@/components/brand/Logo";
import { buildSafeCallbackUrl } from "@/lib/hub-links";

function SignInForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const callbackUrl = buildSafeCallbackUrl(searchParams.get("callbackUrl"));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("Credenciais invalidas. Tente novamente.");
        setLoading(false);
      } else if (result?.ok) {
        const target = result.url || "/dashboard";
        window.location.href = target;
      }
    } catch (err) {
      setError("Erro ao fazer login. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-verde">
      <div className="max-w-sm w-full">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <Logo className="w-16 h-16 mx-auto mb-5" />
          <h1 className="font-display text-3xl font-bold text-white">
            Carreira <span className="text-brand-tangerina">U.S.A.</span>
          </h1>
          <p className="text-white/60 text-sm mt-2">Admin Dashboard</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-7">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-brand-verde mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
                placeholder="seu@email.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-brand-verde mb-1.5">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
                placeholder="********"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl text-center text-white font-semibold text-base transition disabled:opacity-60 bg-brand-tangerina hover:opacity-90"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-white/40 mt-6">
          Powered by SIGMA INTEL
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-brand-verde">
        <div className="text-white/60">Carregando...</div>
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
