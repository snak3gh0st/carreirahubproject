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
      window.location.reload();
    } catch {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center border border-white/20 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => switchLang("en")}
        disabled={loading}
        className="px-3 py-1.5 transition-colors font-medium"
        style={{
          backgroundColor: isEn ? BRAND_COLORS.TANGERINA : "transparent",
          color: isEn ? "#fff" : "rgba(255,255,255,0.6)",
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
          color: !isEn ? "#fff" : "rgba(255,255,255,0.6)",
        }}
      >
        PT
      </button>
    </div>
  );
}
