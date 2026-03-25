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

export default function HubSettingsPage() {
  const [lang, setLang] = useState<Language>("en");
  const [language, setLanguage] = useState("en");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cookieLang = getLangFromCookie();
    setLang(cookieLang);

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
      setMessage({ type: "success", text: t(newLang as Language, "settings.languageUpdated") });
      // Refresh to update layout header
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
        setMessage({ type: "error", text: data.error || t(lang, "settings.passwordChangeFailed") });
        return;
      }
      setMessage({ type: "success", text: t(lang, "settings.passwordChangeSuccess") });
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
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t(lang, "settings.settingsTitle")}</h1>

      {message && (
        <div
          className={`px-4 py-3 rounded-xl text-sm mb-6 ${
            message.type === "success"
              ? "bg-green-50 border border-green-100 text-green-700"
              : "bg-red-50 border border-red-100 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Profile (read-only) */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">{t(lang, "settings.profile")}</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">{t(lang, "settings.name")}</span>
            <span className="font-medium text-gray-900">{profileName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">{t(lang, "settings.email")}</span>
            <span className="font-medium text-gray-900">{profileEmail}</span>
          </div>
        </div>
      </div>

      {/* Language */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">{t(lang, "settings.language")}</h2>
        <div className="flex gap-3">
          <button
            onClick={() => handleLanguageChange("en")}
            className="flex-1 py-3 rounded-xl font-medium text-sm transition border"
            style={{
              backgroundColor: language === "en" ? BRAND_COLORS.TANGERINA : "transparent",
              color: language === "en" ? "#fff" : "#6B7280",
              borderColor: language === "en" ? BRAND_COLORS.TANGERINA : "#E5E7EB",
            }}
          >
            English
          </button>
          <button
            onClick={() => handleLanguageChange("pt-BR")}
            className="flex-1 py-3 rounded-xl font-medium text-sm transition border"
            style={{
              backgroundColor: language === "pt-BR" ? BRAND_COLORS.TANGERINA : "transparent",
              color: language === "pt-BR" ? "#fff" : "#6B7280",
              borderColor: language === "pt-BR" ? BRAND_COLORS.TANGERINA : "#E5E7EB",
            }}
          >
            Portugu&ecirc;s
          </button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-4">
          {t(lang, "settings.changePassword")}
        </h2>
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t(lang, "settings.currentPassword")}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t(lang, "password.newPassword")}</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t(lang, "password.confirmPassword")}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base text-brand-verde focus:outline-none focus:border-brand-verde focus:ring-1 focus:ring-brand-verde transition"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-center text-white font-semibold transition disabled:opacity-60 bg-brand-tangerina hover:bg-brand-tangerina/90"
          >
            {loading ? t(lang, "settings.updating") : t(lang, "settings.updatePassword")}
          </button>
        </form>
      </div>
    </div>
  );
}
