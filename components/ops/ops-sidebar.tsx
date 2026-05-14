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
  UsersRound,
} from "lucide-react";
import { isOperationalManagerRole } from "@/lib/roles";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
}

interface OpsSidebarProps {
  userName?: string;
  userEmail?: string;
  userRole?: string;
}

export function OpsSidebar({ userName = "User", userEmail = "", userRole = "" }: OpsSidebarProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: "/ops", label: "Hoje", icon: CalendarDays },
    { href: "/ops/pipeline", label: "Alunos", icon: ListChecks },
    { href: "/ops/enroll", label: "Matrículas", icon: GraduationCap },
    { href: "/ops/bi", label: "BI", icon: BarChart3 },
    ...(isOperationalManagerRole(userRole)
      ? [
          { href: "/ops/team", label: "Gestão", icon: UsersRound },
        ]
      : []),
  ];

  const isActive = (href: string) => {
    if (href === "/ops") return pathname === "/ops";
    return pathname.startsWith(href);
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-brand-verde flex flex-col z-30">
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
      <nav className="flex-1 px-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-display transition-all duration-200 group ${
                active
                  ? "bg-brand-tangerina text-white font-semibold shadow-lg"
                  : "text-white font-normal hover:bg-white/10"
              }`}
            >
              <Icon className={`h-5 w-5 transition-colors ${
                active ? "text-white" : "text-white/70 group-hover:text-white"
              }`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="px-4 pb-4">
        <div className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/5">
          <div className="w-8 h-8 rounded-full bg-brand-tangerina/20 flex items-center justify-center text-brand-tangerina text-xs font-bold">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white font-medium truncate">{userName}</p>
            <p className="text-[10px] text-white/40 truncate">Operacional</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/ops/login" })}
            className="p-2 text-white/50 hover:text-brand-tangerina hover:bg-white/10 rounded-lg transition-colors"
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
  );
}
