import { cookies } from "next/headers";
import Link from "next/link";

const GOLD = "#C9A84C";

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

  const lang = payload.language || "en";
  const isEn = lang === "en";

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FBF8F0" }}>
      {/* Header — only for authenticated users */}
      {isAuthenticated && (
        <header className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
            <Link href="/hub" className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: GOLD }}
              >
                <span className="text-white text-sm font-bold">C</span>
              </div>
              <div>
                <span className="font-semibold text-gray-900 text-sm block leading-tight">
                  Carreira U.S.A.
                </span>
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                  Client Portal
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-5">
              {/* Language Toggle */}
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden text-xs">
                <button
                  className="px-3 py-1.5 transition-colors font-medium"
                  style={{
                    backgroundColor: isEn ? GOLD : "transparent",
                    color: isEn ? "#fff" : "#9CA3AF",
                  }}
                >
                  EN
                </button>
                <button
                  className="px-3 py-1.5 transition-colors font-medium"
                  style={{
                    backgroundColor: !isEn ? GOLD : "transparent",
                    color: !isEn ? "#fff" : "#9CA3AF",
                  }}
                >
                  PT
                </button>
              </div>

              {/* Settings */}
              <Link
                href="/hub/settings"
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title={isEn ? "Settings" : "Configurações"}
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
                  className="text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {isEn ? "Logout" : "Sair"}
                </button>
              </form>
            </div>
          </div>
        </header>
      )}

      {/* Main content */}
      <main className={isAuthenticated ? "max-w-4xl mx-auto px-6 py-8" : ""}>
        {children}
      </main>
    </div>
  );
}
