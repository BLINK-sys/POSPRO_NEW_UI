import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import Script from "next/script"
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
  generator: 'v0.dev',
  icons: {
    icon: "/ui/favicon.ico",
    apple: "/ui/favicon.ico",
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getProfile()

  return (
    <html lang="ru">
      <head>
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-KQLLLGV');`}
        </Script>
      </head>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-KQLLLGV"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
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
