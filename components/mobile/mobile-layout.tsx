"use client"

import type React from "react"
import MobileHeader from "./mobile-header"
import MobileBottomNav from "./mobile-bottom-nav"

interface MobileLayoutProps {
  children: React.ReactNode
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      <MobileHeader />
      <main className="flex-1 pb-20">
        {children}
      </main>
      <MobileBottomNav />
    </div>
  )
}
