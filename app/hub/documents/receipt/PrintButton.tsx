"use client";

import { t, Language } from "@/lib/i18n/hub";

const GOLD = "#C9A84C";

export default function PrintButton({ lang = "en" }: { lang?: Language }) {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
      style={{ backgroundColor: GOLD }}
    >
      {t(lang, "receipt.printSavePdf")}
    </button>
  );
}
