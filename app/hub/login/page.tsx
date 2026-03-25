"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { Logo } from "@/components/brand/Logo";

function getLangFromCookie(): Language {
  try {
    const match = document.cookie.match(/(?:^|;\s*)hub-token=([^;]*)/);
    if (!match?.[1]) return "en";
    const [, b64] = match[1].split(".");
    if (!b64) return "en";
    const payload = JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
    return (payload?.language || "en") as Language;
  } catch {
    return "en";
  }
}

export default function HubLoginPage() {
  const router = useRouter();
  // Login page: user is not yet authenticated, so there may be no token.
  // Default to "en"; after login the JWT will carry the language.
  const [lang] = useState<Language>(() => {
    if (typeof window !== "undefined") {
      // Detect browser language preference for initial display
      const browserLang = navigator.language;
      if (browserLang.startsWith("pt")) return "pt-BR";
    }
    return "en";
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/hub/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.tempExpired) {
          setError(t(lang, "login.tempExpired"));
        } else if (res.status === 423) {
          setError(t(lang, "login.accountLockedReset"));
        } else {
          setError(data.error || t(lang, "login.loginError"));
        }
        return;
      }

      if (data.mustResetPw) {
        router.push(`/hub/set-password?token=${data.resetToken}`);
        return;
      }

      router.push("/hub");
    } catch {
      setError(t(lang, "errors.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-brand-verde">
      <div className="max-w-sm w-full">
        <div className="text-center mb-8">
          <Logo mono className="w-16 h-16 text-brand-creme mx-auto mb-4" />
          <h1 className="font-display text-3xl font-bold text-brand-creme">{t(lang, "login.loginTitle")}</h1>
          <p className="text-brand-cafe text-sm mt-1">{t(lang, "login.loginSubtitle")}</p>
        </div>

        <div className="bg-brand-creme rounded-2xl shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-verde mb-1.5">{t(lang, "login.email")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-brand-verde mb-1.5">{t(lang, "login.password")}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              className="w-full py-3.5 rounded-xl text-white font-semibold text-base transition disabled:opacity-60 bg-brand-tangerina hover:bg-brand-tangerina/90"
            >
              {loading ? t(lang, "login.signingIn") : t(lang, "login.signIn")}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link href="/hub/reset-password" className="text-sm hover:underline text-brand-verde hover:text-brand-verde/80">
              {t(lang, "login.forgotPassword")}
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-brand-creme/60 mt-6">
          {t(lang, "login.securePortal")}
        </p>
      </div>
    </div>
  );
}
