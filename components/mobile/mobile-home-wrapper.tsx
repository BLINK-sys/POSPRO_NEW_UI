"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import MobileHomePage from "./mobile-home-page"
import type { Banner, HomepageBlock } from "@/app/actions/public"

interface MobileHomeWrapperProps {
  banners: Banner[]
  blocks: HomepageBlock[]
  desktopContent: React.ReactNode
}

export default function MobileHomeWrapper({ banners, blocks, desktopContent }: MobileHomeWrapperProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return <MobileHomePage banners={banners} blocks={blocks} />
  }

  return <>{desktopContent}</>
}
