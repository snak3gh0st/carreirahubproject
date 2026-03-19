"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  FileSignature,
  BarChart3,
  LogOut,
  HeadphonesIcon,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { APP_VERSION } from "@/lib/changelog";
import { NewsNotification } from "./news-notification";

/**
 * Professional Sidebar matching Pencil Design
 * 
 * Structure:
 * - Logo (Carreira)
 * - Navigation (6 main items)
 * - User Profile
 * - Powered by SIGMA INTEL footer
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: string[];
}

const mainNavItems: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL", "COMMERCIAL"],
  },
  {
    href: "/dashboard/invoices",
    label: "Invoices",
    icon: FileText,
    roles: ["ADMIN", "OPERATIONAL", "FINANCE", "SALES", "COMMERCIAL"],
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: Users,
    roles: ["ADMIN", "OPERATIONAL", "SALES", "SDR", "FINANCE", "SUPPORT", "COMMERCIAL"],
  },
  {
    href: "/dashboard/payments",
    label: "Payments",
    icon: CreditCard,
    roles: ["ADMIN", "OPERATIONAL", "FINANCE"],
  },
  {
    href: "/dashboard/contracts",
    label: "Contracts",
    icon: FileSignature,
    roles: ["ADMIN", "OPERATIONAL", "FINANCE", "SALES", "COMMERCIAL"],
  },
  {
    href: "/dashboard/insights",
    label: "Insights",
    icon: BarChart3,
    roles: ["ADMIN", "OPERATIONAL", "FINANCE"],
  },
  {
    href: "/dashboard/support",
    label: "Suporte",
    icon: HeadphonesIcon,
    roles: ["ADMIN", "OPERATIONAL", "SUPPORT"],
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

  // Get user initials for avatar
  const getInitials = (name: string) => {
    const parts = name.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-secondary-dark border-r border-secondary-gray flex flex-col">
      {/* Logo Section */}
      <div className="px-8 py-10">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* Logo Icon - Gold Square */}
          <div className="w-7 h-7 bg-gold-500 rounded flex items-center justify-center">
            <span className="text-white text-sm font-bold">C</span>
          </div>
          {/* Logo Text */}
          <span className="text-lg font-display font-semibold text-white">
            Carreira
          </span>
        </Link>
      </div>

      {/* Navigation Section */}
      <nav className="flex-1 px-4 space-y-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-display transition-all duration-200 group",
                active
                  ? "bg-gold-600 text-white font-semibold shadow-lg shadow-gold-900/20"
                  : "text-gray-300 font-normal hover:bg-secondary-gray hover:text-white"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-colors",
                active ? "text-white" : "text-gray-400 group-hover:text-white"
              )} />
              
              <span>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section - User Profile + Sigma Footer */}
      <div className="px-8 py-6 border-t border-secondary-gray space-y-6">
        {/* User Profile */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 bg-gold-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-white font-display font-medium">
              {getInitials(userName)}
            </span>
          </div>
          
          {/* User Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-medium text-white truncate">
              {userName}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {userRole}
            </p>
          </div>

          {/* Logout Button */}
          <button
            onClick={() => signOut({ callbackUrl: "/auth/signin" })}
            className="p-2 text-white hover:text-gold-500 hover:bg-secondary-gray rounded-lg transition-colors"
            title="Logout"
            aria-label="Logout"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>

        {/* Footer: News + Powered by SIGMA INTEL + Version */}
        <div className="pt-4 border-t border-secondary-gray">
          <div className="flex items-center justify-center gap-2 mb-3">
            <NewsNotification />
          </div>
          <div className="text-center space-y-1">
            <p className="text-[10px] text-gray-500">
              Powered by
            </p>
            <p className="text-xs font-display font-bold text-sigma-blue">
              SIGMA INTEL
            </p>
            <p className="text-[9px] text-gray-600">
              v{APP_VERSION}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
