"use client";

import { t, Language } from "@/lib/i18n/hub";

export default function PrintButton({ lang = "en" }: { lang?: Language }) {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-lg text-sm font-medium text-white transition hover:opacity-90 bg-brand-tangerina"
    >
      {t(lang, "receipt.printSavePdf")}
    </button>
  );
}
