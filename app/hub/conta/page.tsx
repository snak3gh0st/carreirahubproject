"use client";

import { useState, FormEvent, useEffect } from "react";
import { t, Language } from "@/lib/i18n/hub";
import { BRAND_COLORS } from "@/lib/constants/brand";

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

function getProfileFromCookie(): { name?: string; email?: string } {
  try {
    const match = document.cookie.match(/(?:^|;\s*)hub-token=([^;]*)/);
    if (!match?.[1]) return {};
    const [, b64] = match[1].split(".");
    if (!b64) return {};
    return JSON.parse(atob(b64.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return {};
  }
}

export default function ContaPage() {
  const [lang, setLang] = useState<Language>("en");
  const [language, setLanguage] = useState("en");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cookieLang = getLangFromCookie();
    setLang(cookieLang);
    setLanguage(cookieLang);

    // Prefer cookie payload, supplement with API
    const cookieProfile = getProfileFromCookie();
    if (cookieProfile.name) setProfileName(cookieProfile.name);
    if (cookieProfile.email) setProfileEmail(cookieProfile.email);

    fetch("/api/hub/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.name) setProfileName(data.name);
        if (data.email) setProfileEmail(data.email);
        if (data.language) {
          setLanguage(data.language);
          setLang(data.language as Language);
        }
      })
      .catch(() => {});
  }, []);

  const avatarInitial = profileName?.charAt(0)?.toUpperCase() ?? profileEmail?.charAt(0)?.toUpperCase() ?? "U";

  async function handleLanguageChange(newLang: string) {
    setLanguage(newLang);
    setLang(newLang as Language);
    setMessage(null);
    try {
      await fetch("/api/hub/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      });
      window.location.reload();
    } catch {
      setMessage({ type: "error", text: t(newLang as Language, "settings.languageUpdateFailed") });
    }
  }

  async function handlePasswordChange(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (newPassword.length < 8) {
      setMessage({ type: "error", text: t(lang, "settings.passwordMinLength") });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: t(lang, "settings.passwordsNoMatch") });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/hub/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || t(lang, "conta.passwordError") });
        return;
      }
      setMessage({ type: "success", text: t(lang, "conta.passwordSuccess") });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setMessage({ type: "error", text: t(lang, "errors.connectionError") });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">{t(lang, "conta.title")}</h1>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-100 text-green-700"
              : "bg-red-50 border border-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Avatar hero */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-extrabold flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${BRAND_COLORS.VERDE}, ${BRAND_COLORS.TANGERINA})` }}
        >
          {avatarInitial}
        </div>
        <div className="min-w-0">
          <p className="text-base font-bold text-gray-900 truncate">{profileName || "—"}</p>
          <p className="text-sm text-gray-400 truncate">{profileEmail}</p>
          <p className="text-xs text-green-600 font-semibold mt-1">
            ● {t(lang, "conta.activeAccount")}
          </p>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">{t(lang, "settings.language")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t(lang, "conta.languageSubtitle")}</p>
        <div className="flex gap-3">
          <button
            onClick={() => handleLanguageChange("en")}
            className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all border-2 flex items-center justify-center gap-2"
            style={{
              borderColor: language === "en" ? BRAND_COLORS.TANGERINA : "#E5E7EB",
              backgroundColor: language === "en" ? "#fff7ed" : "transparent",
              color: language === "en" ? BRAND_COLORS.TANGERINA : "#6B7280",
            }}
          >
            <span>🇺🇸</span> English
          </button>
          <button
            onClick={() => handleLanguageChange("pt-BR")}
            className="flex-1 py-3 rounded-xl font-semibold text-sm transition-all border-2 flex items-center justify-center gap-2"
            style={{
              borderColor: language === "pt-BR" ? BRAND_COLORS.TANGERINA : "#E5E7EB",
              backgroundColor: language === "pt-BR" ? "#fff7ed" : "transparent",
              color: language === "pt-BR" ? BRAND_COLORS.TANGERINA : "#6B7280",
            }}
          >
            <span>🇧🇷</span> Português
          </button>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-900 mb-1">{t(lang, "settings.changePassword")}</h2>
        <p className="text-xs text-gray-400 mb-4">{t(lang, "conta.passwordSubtitle")}</p>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t(lang, "conta.currentPassword")}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-brand-verde bg-gray-50 focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t(lang, "conta.newPassword")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-brand-verde bg-gray-50 focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">{t(lang, "conta.confirmPassword")}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-brand-verde bg-gray-50 focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-opacity disabled:opacity-60"
            style={{ backgroundColor: BRAND_COLORS.VERDE }}
          >
            {loading ? t(lang, "conta.updating") : t(lang, "conta.updatePassword")}
          </button>
        </form>
      </div>

      {/* Sign out */}
      <div className="text-center pt-2 pb-4">
        <form action="/api/hub/auth/logout" method="POST" className="inline">
          <button
            type="submit"
            className="text-sm text-red-500 hover:text-red-700 font-medium transition-colors flex items-center gap-1.5 mx-auto"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {t(lang, "conta.signOut")}
          </button>
        </form>
      </div>
    </div>
  );
}
