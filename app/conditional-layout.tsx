"use client"

import type React from "react"
import { useState, useEffect } from "react"

import { usePathname } from "next/navigation"
import Header from "@/components/header"
import Footer from "@/components/footer"
import MobileLayout from "@/components/mobile/mobile-layout"

const MOBILE_BREAKPOINT = 768

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isAdminPage = pathname.startsWith("/admin")
  const isAuthPage = pathname.startsWith("/auth")

  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  if (isAdminPage) {
    return <>{children}</>
  }

  // Пока не определили ширину — skeleton с адаптивной высотой header
  if (isMobile === undefined) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="h-14 md:h-24 bg-white dark:bg-gray-950 border-b border-gray-200" />
        <main className="flex-grow">{children}</main>
      </div>
    )
  }

  // Мобильная версия (включая auth)
  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>
  }

  // Десктоп: auth без header/footer
  if (isAuthPage) {
    return <>{children}</>
  }

  // Десктоп: обычные страницы
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">{children}</main>
      <Footer />
    </div>
  )
}
