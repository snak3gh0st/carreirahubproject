import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

const GOLD = "#C9A84C";

// Hub public paths that don't require auth
const PUBLIC_PATHS = ["/hub/login", "/hub/reset-password", "/hub/set-password"];

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

  // For public routes, render without header
  // (middleware handles auth redirect for protected routes)
  if (!token) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "#FBF8F0" }}>
        {children}
      </div>
    );
  }

  // Decode JWT payload for header display (middleware already verified it)
  let payload: { email?: string; language?: string; customerId?: string } = {};
  try {
    const [, payloadB64] = token.split(".");
    if (payloadB64) {
      payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString());
    }
  } catch {
    // Invalid token — middleware will handle redirect
  }

  const lang = payload.language || "en";
  const isEn = lang === "en";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FBF8F0" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/hub" className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: GOLD }}
            >
              <span className="text-white text-xs font-bold">C</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">
              Carreira U.S.A.
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {/* Language Toggle */}
            <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
              <Link
                href="/api/hub/profile?setLang=en"
                className="px-2.5 py-1.5 transition-colors"
                style={{
                  backgroundColor: isEn ? GOLD : "transparent",
                  color: isEn ? "#fff" : "#6B7280",
                }}
              >
                EN
              </Link>
              <Link
                href="/api/hub/profile?setLang=pt-BR"
                className="px-2.5 py-1.5 transition-colors"
                style={{
                  backgroundColor: !isEn ? GOLD : "transparent",
                  color: !isEn ? "#fff" : "#6B7280",
                }}
              >
                PT
              </Link>
            </div>

            {/* Settings */}
            <Link
              href="/hub/settings"
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            {/* Logout */}
            <form action="/api/hub/auth/logout" method="POST">
              <button
                type="submit"
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                {isEn ? "Logout" : "Sair"}
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
