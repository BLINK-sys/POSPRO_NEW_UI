import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"
import { AuthProvider } from "@/context/auth-context"
import { CartProvider } from "@/context/cart-context"
import { CatalogPanelProvider } from "@/context/catalog-panel-context"
import { KPProvider } from "@/context/kp-context"
import { getProfile } from "./actions/auth"
import { Toaster } from "@/components/ui/toaster"
import ConditionalLayout from "./conditional-layout"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Интернет-магазин",
  description: "Современный интернет-магазин на Next.js",
    generator: 'v0.dev'
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getProfile()

  return (
    <html lang="ru">
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <AuthProvider initialUser={user}>
          <CartProvider>
            <KPProvider>
              <CatalogPanelProvider>
                <ConditionalLayout>{children}</ConditionalLayout>
                <Toaster />
              </CatalogPanelProvider>
            </KPProvider>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
