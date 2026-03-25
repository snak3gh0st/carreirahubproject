import { cookies } from "next/headers";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { APP_VERSION } from "@/lib/changelog";
import LanguageToggle from "./LanguageToggle";
import { NewsNotification } from "./NewsNotification";
import { Logo } from "@/components/brand/Logo";

export const metadata = {
  title: "Carreira U.S.A. — Client Portal",
  description: "Manage your invoices and payments",
};

export default async function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = cookies();
  const token = cookieStore.get("hub-token")?.value;

  // Decode JWT payload for header (middleware already verified it)
  let payload: { email?: string; language?: string } = {};
  let isAuthenticated = false;

  if (token) {
    try {
      const [, payloadB64] = token.split(".");
      if (payloadB64) {
        payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
        isAuthenticated = true;
      }
    } catch {
      /* invalid token */
    }
  }

  const lang = (payload.language || "en") as Language;
  const isEn = lang === "en";

  return (
    <div data-portal="hub" className="min-h-screen bg-brand-creme">
      {/* Header — only for authenticated users */}
      {isAuthenticated && (
        <header className="bg-brand-verde sticky top-0 z-10 shadow-md">
          <div className="max-w-4xl mx-auto px-6 py-3.5 flex items-center justify-between">
            <Link href="/hub" className="flex items-center gap-3">
              <Logo className="w-8 h-8" />
              <div>
                <span className="font-display font-bold text-white text-sm">
                  Carreira{" "}
                  <span className="text-brand-tangerina">U.S.A.</span>
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <LanguageToggle currentLang={lang} />

              <div className="flex items-center gap-1">
                <NewsNotification lang={lang} />

                <Link
                  href="/hub/settings"
                  className="flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  title={t(lang, "header.settings")}
                >
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </Link>
              </div>

              <form action="/api/hub/auth/logout" method="POST">
                <button
                  type="submit"
                  className="flex items-center justify-center h-9 px-3 rounded-lg text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {t(lang, "header.logout")}
                </button>
              </form>
            </div>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className={isAuthenticated ? "max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8" : "px-4"}>
        {children}
      </main>

      {/* Footer */}
      {isAuthenticated && (
        <footer className="border-t border-brand-verde/10 bg-brand-verde/5 mt-auto">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <p className="text-[10px] text-brand-verde/40">
              Powered by{" "}
              <span className="font-bold text-sigma-blue">SIGMA INTEL</span>
            </p>
            <p className="text-[10px] text-brand-verde/30">v{APP_VERSION}</p>
          </div>
        </footer>
      )}
    </div>
  );
}
