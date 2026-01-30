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
        {/* Skip to main content for keyboard users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 
                     focus:z-50 focus:px-4 focus:py-2 focus:bg-gold-600 focus:text-white 
                     focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 
                     focus:ring-gold-500 focus:ring-offset-2"
        >
          Pular para o conteúdo principal
        </a>
        
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

