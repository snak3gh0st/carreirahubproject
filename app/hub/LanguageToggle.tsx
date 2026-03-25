"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BRAND_COLORS } from "@/lib/constants/brand";

export default function LanguageToggle({ currentLang }: { currentLang: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const isEn = currentLang === "en";

  async function switchLang(lang: string) {
    if (lang === currentLang || loading) return;
    setLoading(true);
    try {
      await fetch("/api/hub/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: lang }),
      });
      // Refresh page to apply new language from updated JWT
      window.location.reload();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => switchLang("en")}
        disabled={loading}
        className="px-3 py-1.5 transition-colors font-medium"
        style={{
          backgroundColor: isEn ? BRAND_COLORS.TANGERINA : "transparent",
          color: isEn ? "#fff" : "#9CA3AF",
        }}
      >
        EN
      </button>
      <button
        onClick={() => switchLang("pt-BR")}
        disabled={loading}
        className="px-3 py-1.5 transition-colors font-medium"
        style={{
          backgroundColor: !isEn ? BRAND_COLORS.TANGERINA : "transparent",
          color: !isEn ? "#fff" : "#9CA3AF",
        }}
      >
        PT
      </button>
    </div>
  );
}
