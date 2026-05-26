"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Logo } from "@/components/brand/Logo";
import {
  GraduationCap,
  LogOut,
  CalendarDays,
  BarChart3,
  ListChecks,
  MessageSquareText,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { isOperationalManagerRole } from "@/lib/roles";
import { useOpsDigisacUnread } from "@/hooks/ops/useOpsDigisacUnread";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface OpsSidebarProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export function OpsSidebar({ userName = "User", userEmail = "", userRole = "" }: OpsSidebarProps) {
  const pathname = usePathname();
  const { unreadCount } = useOpsDigisacUnread();

  const navItems: NavItem[] = [
    { href: "/ops", label: "Hoje", icon: CalendarDays },
    { href: "/ops/pipeline", label: "Clientes", icon: ListChecks },
    { href: "/ops/digisac", label: "Conversas", icon: MessageSquareText, badge: unreadCount > 0 ? unreadCount : undefined },
    { href: "/ops/enroll", label: "Matrículas", icon: GraduationCap },
    { href: "/ops/ai", label: "AI", icon: Sparkles },
    { href: "/ops/bi", label: "BI", icon: BarChart3 },
    ...(isOperationalManagerRole(userRole)
      ? [{ href: "/ops/team", label: "Gestão", icon: UsersRound }]
      : []),
  ];

  const isActive = (href: string) => {
    if (href === "/ops") return pathname === "/ops";
    return pathname.startsWith(href);
  };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-brand-verde px-4 shadow-lg md:hidden">
        <Link href="/ops" className="flex min-w-0 items-center gap-3">
          <Logo className="h-8 w-8 flex-shrink-0" />
          <div className="min-w-0">
            <span className="block truncate font-display text-sm font-bold leading-tight text-white">
              Carreira <span className="text-brand-tangerina">U.S.A.</span>
            </span>
            <span className="block truncate text-[10px] font-medium uppercase tracking-wider text-white/45">
              Operacional
            </span>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/ops/login" })}
          className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-white/70 transition-colors hover:bg-white/10 hover:text-brand-tangerina"
          title="Logout"
          aria-label="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-brand-verde md:flex">
        {/* Logo */}
        <div className="px-6 pt-8 pb-6">
          <Link href="/ops" className="flex items-center gap-3">
            <Logo className="w-9 h-9" />
            <div>
              <span className="font-display text-base font-bold text-white leading-tight block">
                Carreira <span className="text-brand-tangerina">U.S.A.</span>
              </span>
              <span className="text-[10px] text-white/40 font-medium tracking-wider uppercase">
                Operacional
              </span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-tangerina/50 ${
                  active
                    ? "bg-brand-tangerina text-white shadow-sm"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon className={`h-5 w-5 transition-colors ${
                  active ? "text-white" : "text-white/70 group-hover:text-white"
                }`} />
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div className="px-4 pb-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-3">
            <div className="w-8 h-8 rounded-full bg-brand-tangerina/20 flex items-center justify-center text-brand-tangerina text-xs font-bold">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white font-medium truncate">{userName}</p>
              <p className="text-[10px] text-white/40 truncate">Operacional</p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/ops/login" })}
              className="min-h-10 min-w-10 rounded-lg p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-brand-tangerina focus:outline-none focus:ring-2 focus:ring-brand-tangerina/50"
              title="Logout"
              aria-label="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {/* Footer */}
          <div className="mt-4 px-3 py-2 text-center">
            <p className="text-[9px] text-white/20 tracking-wider uppercase">
              Powered by SIGMA INTEL
            </p>
          </div>
        </div>
      </aside>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid gap-1 border-t border-gray-200 bg-white/95 px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-[10px] font-semibold transition-colors ${
                active
                  ? "bg-brand-tangerina text-white"
                  : "text-gray-500 hover:bg-gray-50 hover:text-brand-verde"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5 flex-shrink-0" />
                {item.badge !== undefined && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[8px] font-bold text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
