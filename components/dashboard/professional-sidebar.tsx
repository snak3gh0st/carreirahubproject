"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import * as LucideIcons from "lucide-react";
import { LogOut, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_VERSION } from "@/lib/changelog";
import { NewsNotification } from "./news-notification";
import { Logo } from "@/components/brand/Logo";
import { getAiHubForRole } from "@/lib/ai/hub-config";
import {
  getSidebarSectionsFor,
  type HubContext,
  type SidebarSection,
} from "@/lib/sidebar/role-config";

/**
 * Derive hub context from URL pathname. Pure function — placed outside the
 * component so it isn't re-allocated on every render.
 *
 * - `/dashboard/commercial/*` → "commercial"
 * - `/dashboard/financial/*`  → "financial"
 * - `/dashboard/admin/*`      → "admin"
 * - `/dashboard/executive/*`  → null (handled by SIDEBAR_BY_ROLE.EXECUTIVE fallback)
 * - `/dashboard` (root) and all other paths → null (legacy URL)
 */
function deriveHubFromPathname(pathname: string | null): HubContext | null {
  if (!pathname) return null;
  if (pathname.startsWith("/dashboard/commercial")) return "commercial";
  if (pathname.startsWith("/dashboard/financial")) return "financial";
  if (pathname.startsWith("/dashboard/admin")) return "admin";
  return null;
}

/**
 * Resolve a lucide-react icon by export name. Returns a fallback Square icon
 * (and warns in dev) when the name is unknown — keeps render bulletproof
 * against data-config typos.
 */
function resolveIcon(
  name: string,
): React.ComponentType<{ className?: string }> {
  const Icon = (LucideIcons as unknown as Record<string, unknown>)[name];
  if (
    typeof Icon === "function" ||
    (typeof Icon === "object" && Icon !== null)
  ) {
    return Icon as React.ComponentType<{ className?: string }>;
  }
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    console.warn(`[ProfessionalSidebar] Unknown lucide icon: ${name}`);
  }
  return LucideIcons.Square as React.ComponentType<{ className?: string }>;
}

interface ProfessionalSidebarProps {
  userRole: string;
  userName?: string;
  userEmail?: string;
}

export function ProfessionalSidebar({
  userRole,
  userName = "User",
  userEmail = "",
}: ProfessionalSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  // Resolve sections from the role + hub-context resolver. Hub is derived from
  // the URL pathname prefix (`/dashboard/{hub}/*`). Unknown roles get empty
  // array (no crash — the role guard at layout level should already redirect).
  // Legacy `/dashboard/*` URLs (hub === null) fall back to current behavior.
  const hub = deriveHubFromPathname(pathname);
  const sections: SidebarSection[] = getSidebarSectionsFor(userRole, hub);

  const aiHub = getAiHubForRole(userRole);
  const aiNavItem = aiHub
    ? {
        href: aiHub.routePath,
        label: aiHub.label,
        icon: Sparkles,
      }
    : null;

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const flatMobileItems = [
    ...sections.flatMap((section) => section.items),
    ...(aiNavItem
      ? [
          {
            href: aiNavItem.href,
            label: aiNavItem.label,
            icon: "Sparkles",
          },
        ]
      : []),
  ].filter(
    (item, index, items) =>
      items.findIndex((candidate) => candidate.href === item.href) === index,
  );

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-brand-verde px-4 shadow-lg md:hidden">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3">
          <Logo className="h-8 w-8 flex-shrink-0" />
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-bold leading-tight text-white">
              Carreira <span className="text-brand-tangerina">U.S.A.</span>
            </span>
            <span className="block truncate text-[10px] font-medium uppercase tracking-wider text-white/45">
              Interno
            </span>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/auth/signin" })}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-brand-tangerina"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <aside className="fixed bottom-0 left-0 top-0 z-30 hidden w-60 flex-col bg-brand-verde md:flex">
        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Logo className="w-9 h-9 flex-shrink-0" />
            <div>
              <span className="text-base font-display font-bold text-white">
                Carreira{" "}
              </span>
              <span className="text-base font-display font-bold text-brand-tangerina">
                U.S.A.
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation — driven by SIDEBAR_BY_ROLE (D-01) */}
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {sections.map((section) => (
            <React.Fragment key={section.label}>
              <div className="pt-3 pb-1 px-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                  {section.label}
                </p>
              </div>
              {section.items.map((item) => {
                const Icon = resolveIcon(item.icon);
                const active = isActive(item.href);
                return (
                  <Link
                    key={`${section.label}::${item.href}`}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-display transition-all duration-200 group",
                      active
                        ? "bg-brand-tangerina text-white font-semibold shadow-lg"
                        : "text-white font-normal hover:bg-white/10",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-5 w-5 transition-colors",
                        active
                          ? "text-white"
                          : "text-white/70 group-hover:text-white",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </React.Fragment>
          ))}

          {aiNavItem &&
            (() => {
              const AiIcon = aiNavItem.icon;
              return (
                <Link
                  href={aiNavItem.href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-display transition-all duration-200 group mt-2",
                    isActive(aiNavItem.href)
                      ? "bg-brand-tangerina text-white font-semibold shadow-lg"
                      : "text-white font-normal hover:bg-white/10",
                  )}
                >
                  <AiIcon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isActive(aiNavItem.href)
                        ? "text-white"
                        : "text-white/70 group-hover:text-white",
                    )}
                  />
                  <span>{aiNavItem.label}</span>
                </Link>
              );
            })()}
        </nav>

        {/* Bottom Section */}
        <div className="px-4 py-5 border-t border-white/10 space-y-5">
          {/* User Profile */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-9 h-9 bg-brand-tangerina rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-xs text-white font-display font-bold">
                {getInitials(userName)}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-display font-medium text-white truncate">
                {userName}
              </p>
              <p className="text-xs text-white/50 truncate">{userRole}</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="p-2 text-white/50 hover:text-brand-tangerina hover:bg-white/10 rounded-lg transition-colors"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Footer: News + Powered by SIGMA INTEL + Version */}
          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center justify-center gap-2 mb-3">
              <NewsNotification />
            </div>
            <div className="text-center space-y-1">
              <p className="text-[10px] text-white/40">Powered by</p>
              <p className="text-xs font-display font-bold text-sigma-blue">
                SIGMA INTEL
              </p>
              <p className="text-[10px] text-white/30">v{APP_VERSION}</p>
            </div>
          </div>
        </div>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-40 flex gap-1 overflow-x-auto border-t border-gray-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden">
        {flatMobileItems.map((item) => {
          const Icon = resolveIcon(item.icon);
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[10px] font-semibold transition-colors",
                active
                  ? "bg-brand-tangerina text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-brand-verde",
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 flex-shrink-0 transition-colors",
                  active ? "text-white" : "text-gray-500",
                )}
              />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
