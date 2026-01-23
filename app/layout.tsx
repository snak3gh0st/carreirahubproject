import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Toaster } from "sonner"

import { QueryProvider } from "@/components/providers/query-provider"
import { SessionProvider } from "@/components/providers/session-provider"
import { ToastProvider } from "@/lib/contexts/toast.context"
import { ToastContainer } from "@/components/ui/toast"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Carreira AI Hub",
  description: "Middleware proprietário para Carreira U.S.A",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <SessionProvider>
          <QueryProvider>
            <ToastProvider>
              {children}
              <ToastContainer />
            </ToastProvider>
          </QueryProvider>
        </SessionProvider>
        <Toaster
          position="top-right"
          richColors
          expand={true}
          closeButton
        />
      </body>
    </html>
  )
}

