// app/hub/HubNavLinks.tsx
"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { t, Language } from "@/lib/i18n/hub";

interface Props {
  lang: Language;
}

const NAV_ITEMS = [
  { labelKey: "navigation.inicio" as const, href: "/hub", exact: true },
  { labelKey: "navigation.financeiro" as const, href: "/hub/financeiro", exact: false },
  { labelKey: "navigation.programa" as const, href: "/hub/programa", exact: false },
  { labelKey: "navigation.documentos" as const, href: "/hub/documentos", exact: false },
];

export default function HubNavLinks({ lang }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden sm:flex items-center gap-0.5">
        {NAV_ITEMS.map(({ labelKey, href, exact }) => (
          <Link
            key={href}
            href={href}
            className={`px-3 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              isActive(href, exact)
                ? "text-brand-tangerina border-brand-tangerina"
                : "text-white/65 border-transparent hover:text-white hover:border-white/20"
            }`}
          >
            {t(lang, labelKey)}
          </Link>
        ))}
      </nav>

      {/* Mobile hamburger button */}
      <button
        className="sm:hidden flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
      >
        {open ? (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Mobile drawer */}
      {open && (
        <div className="sm:hidden absolute top-full left-0 right-0 bg-brand-verde border-t border-white/10 shadow-lg z-20">
          {NAV_ITEMS.map(({ labelKey, href, exact }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={`block px-6 py-4 text-sm font-medium border-b border-white/5 transition-colors ${
                isActive(href, exact)
                  ? "text-brand-tangerina bg-white/5"
                  : "text-white/80 hover:text-white hover:bg-white/5"
              }`}
            >
              {t(lang, labelKey)}
            </Link>
          ))}
          <Link
            href="/hub/conta"
            onClick={() => setOpen(false)}
            className="block px-6 py-4 text-sm font-medium text-white/80 hover:text-white hover:bg-white/5 transition-colors border-b border-white/5"
          >
            {t(lang, "navigation.conta")}
          </Link>
          <form action="/api/hub/auth/logout" method="POST">
            <button
              type="submit"
              className="w-full text-left px-6 py-4 text-sm font-medium text-red-300 hover:text-red-200 hover:bg-white/5 transition-colors"
            >
              {t(lang, "conta.signOut")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
