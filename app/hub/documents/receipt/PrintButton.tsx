"use client";

const GOLD = "#C9A84C";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="px-4 py-2 rounded-lg text-sm font-medium text-white transition hover:opacity-90"
      style={{ backgroundColor: GOLD }}
    >
      Print / Save PDF
    </button>
  );
}
