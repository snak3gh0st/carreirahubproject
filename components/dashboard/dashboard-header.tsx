"use client"

import * as React from "react"
import Link from "next/link"
import { Session } from "next-auth"
import { signOut } from "next-auth/react"
import { Menu, X, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

import { GlobalSearch } from "@/components/search/global-search"

interface DashboardHeaderProps {
  session: Session | null
  userRole: string
}

export function DashboardHeader({ session, userRole }: DashboardHeaderProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"] },
    { href: "/dashboard/leads", label: "Leads", roles: ["ADMIN", "SDR", "SALES"] },
    { href: "/dashboard/conversations", label: "Conversas", roles: ["ADMIN", "SUPPORT", "SDR"] },
    { href: "/dashboard/deals", label: "Negócios", roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"] },
    { href: "/dashboard/invoices", label: "Faturas", roles: ["ADMIN", "FINANCE"] },
    { href: "/dashboard/payments", label: "Pagamentos", roles: ["ADMIN", "FINANCE"] },
    { href: "/dashboard/customers", label: "Clientes", roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"] },
    { href: "/dashboard/insights", label: "Insights", roles: ["ADMIN", "FINANCE"] },
    { href: "/dashboard/integrations", label: "Integrações", roles: ["ADMIN", "FINANCE"] },
    { href: "/", label: "Início", roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"] },
  ]

  const visibleLinks = navLinks.filter((link) => link.roles.includes(userRole))

  const NavLink = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      className="block px-4 py-2 text-sm font-medium text-gray-700"
      onClick={() => setMobileOpen(false)}
    >
      {label}
    </Link>
  )

  return (
    <header className="sticky top-0 z-40 bg-white">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <div className="flex-shrink-0 mr-4 sm:mr-8">
            <Link href="/dashboard" className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Carreira AI Hub
              </h1>
              <p className="text-xs sm:text-sm text-gray-600">Dashboard</p>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1 flex-1">
            {visibleLinks.slice(0, 5).map((link) => (
              <NavLink key={link.href} href={link.href} label={link.label} />
            ))}
          </nav>

          {/* Search - Hidden on small mobile, visible on tablet+ */}
          <div className="hidden sm:block flex-shrink-0 mr-2 sm:mr-4">
            <GlobalSearch />
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2 sm:gap-4">


            {/* User Info - Hidden on mobile */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs sm:text-sm font-medium text-gray-900">
                {session?.user?.name}
              </span>
              <span className="text-xs text-gray-600">
                {userRole}
              </span>
            </div>

            {/* Sair Button - Tablet and Desktop */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="hidden md:flex items-center gap-2 text-gray-700"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Sair</span>
            </Button>

            {/* Mobile Menu Button - Only visible on tablet and below */}
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 sm:h-10 sm:w-10 p-0"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[250px] sm:w-[300px]">
                <div className="flex flex-col gap-4 mt-8">
                  {/* Mobile Search */}
                  <div className="sm:hidden mb-4">
                    <GlobalSearch />
                  </div>

                  {/* Mobile Nav Links */}
                  <nav className="flex flex-col gap-1">
                    {visibleLinks.map((link) => (
                      <NavLink key={link.href} href={link.href} label={link.label} />
                    ))}
                  </nav>

                  {/* Mobile User Info */}
                  <div className="pt-4 mt-4 border-t">
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-900">
                        {session?.user?.name}
                      </p>
                      <p className="text-xs text-gray-600">
                        {session?.user?.email}
                      </p>
                      <p className="text-xs font-semibold text-blue-600">
                        Cargo: {userRole}
                      </p>
                    </div>

                    {/* Mobile Sair Button */}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setMobileOpen(false)
                        signOut({ callbackUrl: "/auth/signin" })
                      }}
                      className="w-full flex items-center justify-center gap-2"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Sair</span>
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  )
}
