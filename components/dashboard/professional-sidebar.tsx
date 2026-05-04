"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Users,
  Users2,
  CreditCard,
  FileSignature,
  ClipboardList,
  BarChart3,
  TrendingUp,
  LogOut,
  HeadphonesIcon,
  GraduationCap,
  Sparkles,
  PieChart,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_VERSION } from "@/lib/changelog";
import { NewsNotification } from "./news-notification";
import { Logo } from "@/components/brand/Logo";
import { getAiHubForRole } from "@/lib/ai/hub-config";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
  sectionBefore?: string;
}

const mainNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Início",
    icon: LayoutDashboard,
    roles: ["ADMIN", "FINANCE", "COMMERCIAL"],
  },
  {
    href: "/dashboard/invoices",
    label: "Faturas",
    icon: FileText,
    roles: ["ADMIN", "FINANCE", "COMMERCIAL"],
  },
  {
    href: "/dashboard/customers",
    label: "Clientes",
    icon: Users,
    roles: ["ADMIN", "FINANCE", "COMMERCIAL"],
  },
  {
    href: "/dashboard/payments",
    label: "Pagamentos",
    icon: CreditCard,
    roles: ["ADMIN", "FINANCE"],
  },
  {
    href: "/dashboard/contracts",
    label: "Contratos",
    icon: FileSignature,
    roles: ["ADMIN", "FINANCE", "COMMERCIAL"],
  },
  {
    href: "/dashboard/forms",
    label: "Formulários",
    icon: ClipboardList,
    roles: ["ADMIN"],
  },
  {
    href: "/dashboard/insights",
    label: "Relatórios QB",
    icon: BarChart3,
    roles: ["ADMIN"],
  },
  {
    href: "/dashboard/team",
    label: "Equipe",
    icon: Users2,
    roles: ["ADMIN"],
    sectionBefore: "Admin",
  },
  {
    href: "/dashboard/bi",
    label: "BI Admin",
    icon: PieChart,
    roles: ["ADMIN"],
    sectionBefore: "Intelligence",
  },
  {
    href: "/dashboard/financial",
    label: "BI Financeiro",
    icon: TrendingUp,
    roles: ["ADMIN", "FINANCE"],
  },
  {
    href: "/dashboard/support",
    label: "Suporte",
    icon: HeadphonesIcon,
    roles: ["ADMIN"],
  },
  {
    href: "/ops/enroll",
    label: "Matricular",
    icon: GraduationCap,
    roles: ["ADMIN", "OPERATIONAL"],
  },
];

interface ProfessionalSidebarProps {
  userRole: string;
  userName?: string;
  userEmail?: string;
}

export function ProfessionalSidebar({
  userRole,
  userName = "User",
  userEmail = ""
}: ProfessionalSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    return pathname.startsWith(href);
  };

  const visibleNavItems = mainNavItems.filter((item) =>
    item.roles.includes(userRole)
  );
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

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-brand-verde flex flex-col">
      {/* Logo */}
      <div className="px-6 pt-8 pb-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Logo className="w-9 h-9 flex-shrink-0" />
          <div>
            <span className="text-base font-display font-bold text-white">Carreira </span>
            <span className="text-base font-display font-bold text-brand-tangerina">U.S.A.</span>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 space-y-1">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <React.Fragment key={item.href}>
              {item.sectionBefore && (
                <div className="pt-3 pb-1 px-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-white/35">
                    {item.sectionBefore}
                  </p>
                </div>
              )}
              <Link
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-display transition-all duration-200 group",
                  active
                    ? "bg-brand-tangerina text-white font-semibold shadow-lg"
                    : "text-white font-normal hover:bg-white/10"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 transition-colors",
                  active ? "text-white" : "text-white/70 group-hover:text-white"
                )} />
                <span>{item.label}</span>
              </Link>
            </React.Fragment>
          );
        })}
        {aiNavItem && (
          (() => {
            const AiIcon = aiNavItem.icon;

            return (
              <Link
                href={aiNavItem.href}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-display transition-all duration-200 group",
                  isActive(aiNavItem.href)
                    ? "bg-brand-tangerina text-white font-semibold shadow-lg"
                    : "text-white font-normal hover:bg-white/10"
                )}
              >
                <AiIcon className={cn(
                  "h-5 w-5 transition-colors",
                  isActive(aiNavItem.href) ? "text-white" : "text-white/70 group-hover:text-white"
                )} />
                <span>{aiNavItem.label}</span>
              </Link>
            );
          })()
        )}
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
            <p className="text-xs text-white/50 truncate">
              {userRole}
            </p>
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
            <p className="text-[10px] text-white/40">
              Powered by
            </p>
            <p className="text-xs font-display font-bold text-sigma-blue">
              SIGMA INTEL
            </p>
            <p className="text-[10px] text-white/30">
              v{APP_VERSION}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
