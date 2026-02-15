"use client"

import { Suspense } from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import MobileSearchPage from "@/components/mobile/mobile-search-page"
import DesktopSearchPage from "@/components/desktop-search-page"

function SearchContent() {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MobileSearchPage />
  }

  return <DesktopSearchPage />
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-yellow" /></div>}>
      <SearchContent />
    </Suspense>
  )
}
