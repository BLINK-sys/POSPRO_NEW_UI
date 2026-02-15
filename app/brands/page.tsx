"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import MobileBrandsPage from "@/components/mobile/mobile-brands-page"
import { Loader2 } from "lucide-react"

export default function BrandsPage() {
  const isMobile = useIsMobile()

  if (isMobile === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  // Both mobile and desktop show the brands page
  return <MobileBrandsPage />
}
