"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils/cn"

interface SearchResult {
  id: string
  type: "invoice" | "customer" | "lead" | "deal"
  title: string
  subtitle?: string
  href: string
  status?: string
  amount?: number
  value?: number
}

interface SearchResults {
  invoices: SearchResult[]
  customers: SearchResult[]
  leads: SearchResult[]
  deals: SearchResult[]
}

export function GlobalSearch() {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const [results, setResults] = React.useState<SearchResults | null>(null)
  const [loading, setLoading] = React.useState(false)

  // Handle keyboard shortcut (Cmd+K / Ctrl+K)
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  // Fetch search results
  React.useEffect(() => {
    const fetchResults = async () => {
      if (!search || search.trim().length === 0) {
        setResults(null)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(search)}`)
        if (response.ok) {
          const data = await response.json()
          setResults(data)
        }
      } catch (error) {
        console.error("Search error:", error)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchResults, 300) // Debounce
    return () => clearTimeout(timer)
  }, [search])

  const handleSelect = (href: string) => {
    setOpen(false)
    setSearch("")
    router.push(href)
  }

  const hasResults =
    results &&
    (results.invoices.length > 0 ||
      results.customers.length > 0 ||
      results.leads.length > 0 ||
      results.deals.length > 0)

  return (
    <>
      {/* Search Button */}
      <Button
        variant="ghost"
        className="relative w-full justify-start text-sm text-muted-foreground sm:pr-12 md:w-40 lg:w-64"
        onClick={() => setOpen(true)}
      >
        <Search className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline-flex">Search...</span>
        <span className="inline-flex lg:hidden">Search...</span>
        <kbd className="pointer-events-none absolute right-1.5 hidden h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      {/* Search Dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search invoices, customers, leads, deals..."
          value={search}
          onValueChange={setSearch}
        />

        <CommandList>
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Loading results...
            </div>
          )}

          {!loading && !hasResults && search && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!loading && !search && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Type to search or press ESC to close
            </div>
          )}

          {!loading && hasResults && (
            <>
              {/* Invoices */}
              {results.invoices.length > 0 && (
                <>
                  <CommandGroup heading="Invoices">
                    {results.invoices.map((invoice) => (
                      <CommandItem
                        key={invoice.id}
                        value={invoice.id}
                        onSelect={() => handleSelect(invoice.href)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <p className="font-medium">{invoice.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {invoice.subtitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 text-right">
                            {invoice.amount && (
                              <span className="text-sm font-medium">
                                ${invoice.amount.toLocaleString()}
                              </span>
                            )}
                            {invoice.status && (
                              <span
                                className={cn(
                                  "rounded-full px-2 py-1 text-xs font-medium",
                                  invoice.status === "PAID"
                                    ? "bg-green-100 text-green-800"
                                    : invoice.status === "OVERDUE"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                )}
                              >
                                {invoice.status}
                              </span>
                            )}
                          </div>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Customers */}
              {results.customers.length > 0 && (
                <>
                  <CommandGroup heading="Customers">
                    {results.customers.map((customer) => (
                      <CommandItem
                        key={customer.id}
                        value={customer.id}
                        onSelect={() => handleSelect(customer.href)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-1 flex-col">
                          <p className="font-medium">{customer.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {customer.subtitle}
                          </p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Leads */}
              {results.leads.length > 0 && (
                <>
                  <CommandGroup heading="Leads">
                    {results.leads.map((lead) => (
                      <CommandItem
                        key={lead.id}
                        value={lead.id}
                        onSelect={() => handleSelect(lead.href)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-1 items-center justify-between">
                          <div>
                            <p className="font-medium">{lead.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {lead.subtitle}
                            </p>
                          </div>
                          {lead.status && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-xs font-medium",
                                lead.status === "QUALIFIED"
                                  ? "bg-blue-100 text-blue-800"
                                  : lead.status === "CONVERTED"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-100 text-gray-800"
                              )}
                            >
                              {lead.status}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <CommandSeparator />
                </>
              )}

              {/* Deals */}
              {results.deals.length > 0 && (
                <CommandGroup heading="Deals">
                  {results.deals.map((deal) => (
                    <CommandItem
                      key={deal.id}
                      value={deal.id}
                      onSelect={() => handleSelect(deal.href)}
                      className="cursor-pointer"
                    >
                      <div className="flex flex-1 items-center justify-between">
                        <div>
                          <p className="font-medium">{deal.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {deal.subtitle}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          {deal.value && (
                            <span className="text-sm font-medium">
                              ${deal.value.toLocaleString()}
                            </span>
                          )}
                          {deal.status && (
                            <span
                              className={cn(
                                "rounded-full px-2 py-1 text-xs font-medium",
                                deal.status === "WON"
                                  ? "bg-green-100 text-green-800"
                                  : deal.status === "LOST"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-gray-100 text-gray-800"
                              )}
                            >
                              {deal.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}
