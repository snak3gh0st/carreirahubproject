"use client"

import * as React from "react"
import Link from "next/link"
import { Session } from "next-auth"
import { signOut } from "next-auth/react"
import { Menu, X, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/theme-toggle"
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
    { href: "/dashboard/deals", label: "Deals", roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"] },
    { href: "/dashboard/invoices", label: "Invoices", roles: ["ADMIN", "FINANCE"] },
    { href: "/dashboard/payments", label: "Payments", roles: ["ADMIN", "FINANCE"] },
    { href: "/dashboard/customers", label: "Customers", roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"] },
    { href: "/dashboard/integrations", label: "Integrations", roles: ["ADMIN", "FINANCE"] },
    { href: "/", label: "Home", roles: ["ADMIN", "SALES", "SDR", "FINANCE", "SUPPORT", "OPERATIONAL"] },
  ]

  const visibleLinks = navLinks.filter((link) => link.roles.includes(userRole))

  const NavLink = ({ href, label }: { href: string; label: string }) => (
    <Link
      href={href}
      className="block px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-md transition"
      onClick={() => setMobileOpen(false)}
    >
      {label}
    </Link>
  )

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-800 shadow-sm border-b dark:border-slate-700">
      <div className="container mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo */}
          <div className="flex-shrink-0 mr-4 sm:mr-8">
            <Link href="/dashboard" className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Carreira AI Hub
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Dashboard</p>
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
            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Email - Hidden on mobile */}
            <span className="hidden sm:inline-block text-xs sm:text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
              {session?.user?.email}
            </span>

            {/* Logout Button - Desktop Only */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut({ callbackUrl: "/auth/signin" })}
              className="hidden lg:flex items-center gap-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm">Logout</span>
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
                  <div className="pt-4 mt-4 border-t dark:border-slate-700">
                    <p className="text-xs text-gray-600 dark:text-gray-400 break-all mb-4">
                      {session?.user?.email}
                    </p>

                    {/* Mobile Logout Button */}
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
                      <span>Logout</span>
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
