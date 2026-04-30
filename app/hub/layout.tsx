import { cookies } from "next/headers";
import Link from "next/link";
import { t, Language } from "@/lib/i18n/hub";
import { APP_VERSION } from "@/lib/changelog";
import LanguageToggle from "./LanguageToggle";
import { NewsNotification } from "./NewsNotification";
import { Logo } from "@/components/brand/Logo";
import HubNavLinks from "./HubNavLinks";

export const metadata = {
  title: "Carreira U.S.A. — Client Portal",
  description: "Manage your invoices and payments",
};

export default async function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-token")?.value;

  // Decode JWT payload for header (middleware already verified it)
  let payload: { email?: string; language?: string; name?: string } = {};
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
          <div className="max-w-4xl mx-auto px-6 py-0 flex items-center gap-4 relative">
            {/* Logo */}
            <Link href="/hub" className="flex items-center gap-3 shrink-0 py-3.5">
              <Logo className="w-8 h-8" />
              <span className="font-display font-bold text-white text-sm hidden md:block">
                Carreira <span className="text-brand-tangerina">U.S.A.</span>
              </span>
            </Link>

            {/* Nav links — flex-1 so it fills the middle */}
            <div className="flex-1 flex items-stretch h-full">
              <HubNavLinks lang={lang} />
            </div>

            {/* Right: language, news, avatar */}
            <div className="flex items-center gap-2 shrink-0 py-3.5">
              <LanguageToggle currentLang={lang} />
              <NewsNotification lang={lang} />
              <Link
                href="/hub/conta"
                className="flex items-center justify-center w-8 h-8 rounded-full bg-brand-tangerina text-white text-xs font-bold hover:opacity-90 transition-opacity"
                title={t(lang, "navigation.conta")}
              >
                {payload.name
                  ? payload.name.charAt(0).toUpperCase()
                  : payload.email?.charAt(0).toUpperCase() ?? "U"}
              </Link>
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
