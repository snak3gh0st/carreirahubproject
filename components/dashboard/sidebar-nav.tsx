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
  FileSignature,
  FilePlus,
  Sparkles,
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
    title: "Visão Geral",
    roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"],
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/ai",
        label: "IA",
        icon: Sparkles,
        roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
    ],
  },
  {
    title: "IA & Análises",
    roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"],
    items: [
      {
        href: "/dashboard/admin/ai",
        label: "Briefing (Admin)",
        icon: Sparkles,
        roles: ["ADMIN"],
      },
      {
        href: "/dashboard/financial/ai",
        label: "Raio-X Financeiro",
        icon: Sparkles,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/commercial/ai",
        label: "Pulso do Pipeline",
        icon: Sparkles,
        roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/commercial-bi",
        label: "BI Comercial",
        icon: BarChart3,
        roles: ["ADMIN", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/operational/ai",
        label: "Status da Base",
        icon: Sparkles,
        roles: ["ADMIN"],
      },
    ],
  },
  {
    title: "Vendas & Leads",
    roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"],
    items: [
      {
        href: "/dashboard/leads",
        label: "Leads",
        icon: Users,
        roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/conversations",
        label: "Conversas",
        icon: MessageSquare,
        roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/deals",
        label: "Negócios",
        icon: Briefcase,
        roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/invoices/new",
        label: "Criar Fatura",
        icon: PlusCircle,
        roles: ["ADMIN", "COMMERCIAL"],
      },
      {
        href: "/dashboard/invoices",
        label: "Faturas",
        icon: FileText,
        roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/contracts/new",
        label: "Criar Contrato",
        icon: FilePlus,
        roles: ["ADMIN", "COMMERCIAL"],
      },
    ],
  },
  {
    title: "Financeiro",
    roles: ["ADMIN", "FINANCE"],
    items: [
      {
        href: "/dashboard/invoices",
        label: "Faturas",
        icon: FileText,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/contracts",
        label: "Contratos",
        icon: FileSignature,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/contracts/new",
        label: "Criar Contrato",
        icon: FilePlus,
        roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/invoices/new",
        label: "Criar Fatura",
        icon: PlusCircle,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/invoices/approval-queue",
        label: "Fila de Aprovação",
        icon: CheckCircle,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/payments",
        label: "Pagamentos",
        icon: CreditCard,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/customers",
        label: "Clientes",
        icon: Building2,
        roles: ["ADMIN", "FINANCE", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/customers/new",
        label: "Criar Cliente",
        icon: PlusCircle,
        roles: ["ADMIN", "FINANCE"],
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
    title: "Comercial",
    roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"],
    items: [
      {
        href: "/dashboard/customers/new",
        label: "Criar Cliente",
        icon: Users,
        roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/invoices/new",
        label: "Criar Fatura",
        icon: PlusCircle,
        roles: ["ADMIN", "COMMERCIAL"],
      },
      {
        href: "/dashboard/invoices",
        label: "Faturas",
        icon: FileText,
        roles: ["ADMIN", "COMMERCIAL", "HEAD_COMERCIAL"],
      },
      {
        href: "/dashboard/contracts/new",
        label: "Criar Contrato",
        icon: FilePlus,
        roles: ["ADMIN", "COMMERCIAL"],
      },
    ],
  },
  {
    title: "Integrações",
    roles: ["ADMIN", "FINANCE"],
    items: [
      {
        href: "/dashboard/integrations/hub",
        label: "Hub de Integrações",
        icon: Link2,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/integrations/sync-status",
        label: "Status de Sincronização",
        icon: Workflow,
        roles: ["ADMIN", "FINANCE"],
      },
      {
        href: "/dashboard/integrations/bulk-import",
        label: "Importação em Massa",
        icon: FileText,
        roles: ["ADMIN", "FINANCE"],
      },
    ],
  },
  {
    title: "Administração",
    roles: ["ADMIN"],
    items: [
      {
        href: "/dashboard/settings/integrations",
        label: "Configurações",
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
        label: "Fluxos de Trabalho",
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
    "Visão Geral",
    "Vendas & Leads",
    "Financeiro",
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
        "fixed left-0 top-16 sm:top-20 bottom-0 bg-white",
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
                  className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500"
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
                            ? "bg-blue-50"
                            : "text-gray-700",
                          collapsed && "justify-center"
                        )}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon className={cn("h-5 w-5 flex-shrink-0", active && "text-blue-600")} />
                        {!collapsed && <span>{item.label}</span>}
                        {!collapsed && item.badge && (
                          <span className="ml-auto inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
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
