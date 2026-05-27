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
  ClipboardList,
  ListChecks,
  MessageSquareText,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { isOperationalManagerRole } from "@/lib/roles";
import { useOpsDigisacUnread } from "@/hooks/ops/useOpsDigisacUnread";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

interface OpsSidebarProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export function OpsSidebar({ userName = "User", userEmail = "", userRole = "" }: OpsSidebarProps) {
  const pathname = usePathname();
  const { unreadCount } = useOpsDigisacUnread();
  const isManager = isOperationalManagerRole(userRole);

  const groups: NavGroup[] = [
    {
      label: "Diário",
      items: [
        { href: "/ops", label: "Hoje", icon: CalendarDays },
        {
          href: "/ops/digisac",
          label: "Conversas",
          icon: MessageSquareText,
          badge: unreadCount > 0 ? unreadCount : undefined,
        },
      ],
    },
    {
      label: "Trabalho",
      items: [
        { href: "/ops/pipeline", label: "Pipeline", icon: ListChecks },
        { href: "/ops/enroll", label: "Matrículas", icon: GraduationCap },
        { href: "/ops/forms", label: "Formulários", icon: ClipboardList },
        { href: "/ops/ai", label: "Assistente AI", icon: Sparkles },
      ],
    },
    {
      label: "Insights",
      items: [
        { href: "/ops/bi", label: "BI", icon: BarChart3 },
        ...(isManager ? [{ href: "/ops/team", label: "Gestão", icon: UsersRound }] : []),
      ],
    },
  ];

  // Flat list for mobile bottom nav, grouped for desktop
  const flatItems = groups.flatMap((g) => g.items);

  const isActive = (href: string) => {
    if (href === "/ops") return pathname === "/ops";
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile header */}
      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-brand-verde-700/50 bg-brand-verde px-4 md:hidden">
        <Link href="/ops" className="flex min-w-0 items-center gap-2.5">
          <Logo className="h-7 w-7 flex-shrink-0" />
          <div className="min-w-0">
            <span className="block truncate text-[13px] font-semibold leading-none text-white">
              Carreira <span className="text-brand-tangerina">USA</span>
            </span>
            <span className="mt-0.5 block truncate text-[9px] font-medium uppercase tracking-[0.12em] text-white/40">
              Operacional
            </span>
          </div>
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/ops/login" })}
          className="flex h-9 w-9 items-center justify-center rounded-md text-white/60 transition hover:bg-white/10 hover:text-white"
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col bg-brand-verde md:flex">
        {/* Brand */}
        <Link
          href="/ops"
          className="group flex items-center gap-2.5 px-5 pt-6 pb-7 transition-opacity hover:opacity-95"
        >
          <Logo className="h-8 w-8 flex-shrink-0" />
          <div className="min-w-0">
            <span className="block text-[14px] font-semibold leading-none text-white">
              Carreira <span className="text-brand-tangerina">USA</span>
            </span>
            <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40">
              Operacional
            </span>
          </div>
        </Link>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto px-3">
          {groups.map((group, gIdx) => (
            <div key={group.label} className={gIdx === 0 ? "" : "mt-5"}>
              <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/35">
                {group.label}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-tangerina/60 ${
                          active
                            ? "bg-white/[0.08] text-white"
                            : "text-white/70 hover:bg-white/[0.04] hover:text-white"
                        }`}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-tangerina"
                          />
                        )}
                        <Icon
                          className={`h-[18px] w-[18px] flex-shrink-0 transition-colors ${
                            active ? "text-brand-tangerina" : "text-white/55 group-hover:text-white/80"
                          }`}
                          strokeWidth={1.75}
                        />
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.badge !== undefined && (
                          <span
                            className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold tabular-nums ${
                              active
                                ? "bg-brand-tangerina text-white"
                                : "bg-brand-tangerina/90 text-white"
                            }`}
                            aria-label={`${item.badge} não-lidos`}
                          >
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User section */}
        <div className="border-t border-white/[0.06] px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2 transition hover:bg-white/[0.04]">
            <div
              aria-hidden
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-tangerina/20 text-[12px] font-bold text-brand-tangerina"
            >
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium leading-tight text-white">{userName}</p>
              {userEmail && (
                <p className="mt-0.5 truncate text-[10px] leading-tight text-white/40">{userEmail}</p>
              )}
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/ops/login" })}
              className="flex h-8 w-8 items-center justify-center rounded-md text-white/45 transition hover:bg-white/[0.06] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-tangerina/60"
              title="Sair"
              aria-label="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-2 px-2 text-center text-[9px] font-medium uppercase tracking-[0.12em] text-white/20">
            Sigma Intel
          </p>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid gap-0.5 border-t border-gray-200 bg-white/95 px-1 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-1.5 backdrop-blur md:hidden"
        style={{ gridTemplateColumns: `repeat(${flatItems.length}, minmax(0, 1fr))` }}
        aria-label="Navegação"
      >
        {flatItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium transition ${
                active ? "text-brand-verde" : "text-gray-500 hover:text-brand-verde/80"
              }`}
            >
              <span className="relative">
                <Icon
                  className="h-[20px] w-[20px] flex-shrink-0"
                  strokeWidth={active ? 2 : 1.75}
                />
                {item.badge !== undefined && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-brand-tangerina px-1 text-[8px] font-bold leading-none tabular-nums text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate">{item.label}</span>
              {active && (
                <span aria-hidden className="mt-0.5 h-0.5 w-5 rounded-full bg-brand-tangerina" />
              )}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
