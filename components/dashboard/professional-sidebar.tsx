"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  FileSignature,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

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
    roles: ["ADMIN", "FINANCE", "SALES", "COMMERCIAL"],
  },
  {
    href: "/dashboard/customers",
    label: "Customers",
    icon: Users,
    roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL", "COMMERCIAL"],
  },
  {
    href: "/dashboard/payments",
    label: "Payments",
    icon: CreditCard,
    roles: ["ADMIN", "FINANCE"],
  },
  {
    href: "/dashboard/contracts",
    label: "Contracts",
    icon: FileSignature,
    roles: ["ADMIN", "FINANCE", "SALES", "COMMERCIAL"],
  },
  {
    href: "/dashboard/insights",
    label: "Insights",
    icon: BarChart3,
    roles: ["ADMIN", "FINANCE"],
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
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-white border-r border-gray-200 flex flex-col">
      {/* Logo Section */}
      <div className="px-8 py-10">
        <Link href="/dashboard" className="flex items-center gap-3">
          {/* Logo Icon - Blue Square */}
          <div className="w-7 h-7 bg-primary-600 rounded flex items-center justify-center">
            <span className="text-white text-sm font-bold">C</span>
          </div>
          {/* Logo Text */}
          <span className="text-lg font-display font-semibold text-gray-900">
            Carreira
          </span>
        </Link>
      </div>

      {/* Navigation Section */}
      <nav className="flex-1 px-8 space-y-2">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-display transition-colors group",
                active
                  ? "text-gray-900 font-medium"
                  : "text-gray-700 font-normal hover:text-gray-900"
              )}
            >
              {/* Active Dot Indicator */}
              <div
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-colors",
                  active ? "bg-primary-600" : "bg-transparent"
                )}
              />
              
              <span className={cn(
                active && "font-medium"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom Section - User Profile + Sigma Footer */}
      <div className="px-8 py-6 border-t border-gray-200 space-y-6">
        {/* User Profile */}
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="w-9 h-9 bg-gray-900 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs text-white font-display font-medium">
              {getInitials(userName)}
            </span>
          </div>
          
          {/* User Info */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-display font-medium text-gray-900 truncate">
              {userName}
            </p>
            <p className="text-xs text-gray-600 truncate">
              {userRole}
            </p>
          </div>
        </div>

        {/* Powered by SIGMA INTEL Footer */}
        <div className="text-center space-y-2 pt-4 border-t border-gray-200">
          <p className="text-[10px] text-gray-600">
            Powered by
          </p>
          <p className="text-xs font-display font-bold text-sigma-blue">
            SIGMA INTEL
          </p>
        </div>
      </div>
    </aside>
  );
}
