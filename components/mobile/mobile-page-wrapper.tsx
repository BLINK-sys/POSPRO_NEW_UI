"use client"

import type React from "react"
import { useIsMobile } from "@/hooks/use-mobile"

interface MobilePageWrapperProps {
  mobileComponent: React.ReactNode
  desktopContent: React.ReactNode
}

export default function MobilePageWrapper({ mobileComponent, desktopContent }: MobilePageWrapperProps) {
  const isMobile = useIsMobile()
  if (isMobile) return <>{mobileComponent}</>
  return <>{desktopContent}</>
}
