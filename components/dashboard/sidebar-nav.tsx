"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Briefcase,
  FileText,
  CreditCard,
  Building2,
  BarChart3,
  Link2,
  Settings,
  Webhook,
  Workflow,
  ChevronDown,
  ChevronRight,
  PlusCircle,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils/cn"

interface NavSection {
  title: string
  roles: string[]
  items: NavItem[]
}

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  roles: string[]
  badge?: string
}

const navigationSections: NavSection[] = [
  {
    title: "Overview",
    roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"],
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"],
      },
    ],
  },
  {
    title: "Sales & Leads",
    roles: ["ADMIN", "SALES", "SDR"],
    items: [
      {
        href: "/dashboard/leads",
        label: "Leads",
        icon: Users,
        roles: ["ADMIN", "SDR", "SALES"],
      },
      {
        href: "/dashboard/conversations",
        label: "Conversations",
        icon: MessageSquare,
        roles: ["ADMIN", "SUPPORT", "SDR"],
      },
      {
        href: "/dashboard/deals",
        label: "Deals",
        icon: Briefcase,
        roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"],
      },
      {
        href: "/dashboard/invoices/new",
        label: "Create Invoice",
        icon: PlusCircle,
        roles: ["ADMIN", "SALES"],
      },
      {
        href: "/dashboard/invoices",
        label: "My Invoices",
        icon: FileText,
        roles: ["ADMIN", "SALES"],
      },
    ],
  },
  {
    title: "Finance",
    roles: ["ADMIN", "FINANCE"],
    items: [
      {
        href: "/dashboard/invoices",
        label: "Invoices",
        icon: FileText,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/invoices/new",
        label: "Create Invoice",
        icon: PlusCircle,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/invoices/approval-queue",
        label: "Approval Queue",
        icon: CheckCircle,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/payments",
        label: "Payments",
        icon: CreditCard,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/customers",
        label: "Customers",
        icon: Building2,
        roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"],
      },
      {
        href: "/dashboard/insights",
        label: "Insights",
        icon: BarChart3,
        roles: ["ADMIN", "FINANCE"],
      },
    ],
  },
  {
    title: "Commercial",
    roles: ["ADMIN", "COMMERCIAL"],
    items: [
      {
        href: "/dashboard/customers/new",
        label: "Criar Cliente",
        icon: Users,
        roles: ["ADMIN", "COMMERCIAL"],
      },
      {
        href: "/dashboard/invoices/new",
        label: "Create Invoice",
        icon: PlusCircle,
        roles: ["ADMIN", "COMMERCIAL"],
      },
      {
        href: "/dashboard/invoices",
        label: "My Invoices",
        icon: FileText,
        roles: ["ADMIN", "COMMERCIAL"],
      },
    ],
  },
  {
    title: "Integrations",
    roles: ["ADMIN", "FINANCE"],
    items: [
      {
        href: "/dashboard/integrations/hub",
        label: "Integration Hub",
        icon: Link2,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/integrations/sync-status",
        label: "Sync Status",
        icon: Workflow,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/integrations/bulk-import",
        label: "Bulk Import",
        icon: FileText,
        roles: ["ADMIN", "FINANCE"],
      },
    ],
  },
  {
    title: "Admin",
    roles: ["ADMIN"],
    items: [
      {
        href: "/dashboard/settings/integrations",
        label: "Settings",
        icon: Settings,
        roles: ["ADMIN"],
      },
      {
        href: "/dashboard/webhooks",
        label: "Webhooks",
        icon: Webhook,
        roles: ["ADMIN"],
      },
      {
        href: "/dashboard/workflows",
        label: "Workflows",
        icon: Workflow,
        roles: ["ADMIN"],
      },
    ],
  },
]

interface SidebarNavProps {
  userRole: string
  collapsed?: boolean
}

export function SidebarNav({ userRole, collapsed = false }: SidebarNavProps) {
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = React.useState<string[]>([
    "Overview",
    "Sales & Leads",
    "Finance",
  ])

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]
    )
  }

  const isActive = (href: string) => {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  const visibleSections = navigationSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(userRole)),
    }))
    .filter((section) => section.roles.includes(userRole) && section.items.length > 0)

  return (
    <aside
      className={cn(
        "fixed left-0 top-16 sm:top-20 bottom-0 bg-white dark:bg-slate-800 border-r dark:border-slate-700 transition-all duration-300 z-30",
        collapsed ? "w-16" : "w-64",
        "hidden lg:block" // Hidden on mobile, visible on desktop
      )}
    >
      <nav className="h-full overflow-y-auto py-4 px-2">
        {visibleSections.map((section) => {
          const isExpanded = expandedSections.includes(section.title)

          return (
            <div key={section.title} className="mb-4">
              {/* Section Header */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider hover:text-gray-700 dark:hover:text-gray-300 transition"
                >
                  <span>{section.title}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </button>
              )}

              {/* Section Items */}
              {(isExpanded || collapsed) && (
                <div className={cn("space-y-1", collapsed ? "mt-2" : "mt-1")}>
                  {section.items.map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          active
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700",
                          collapsed && "justify-center"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className={cn("h-5 w-5 flex-shrink-0", active && "text-blue-600 dark:text-blue-400")} />
                        {!collapsed && <span>{item.label}</span>}
                        {!collapsed && item.badge && (
                          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
    </aside>
  )
}
