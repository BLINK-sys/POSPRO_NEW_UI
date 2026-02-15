"use client"

import { useIsMobile } from "@/hooks/use-mobile"
import MobileContactsPage from "@/components/mobile/mobile-contacts-page"
import { Loader2 } from "lucide-react"

export default function ContactsPage() {
  const isMobile = useIsMobile()

  // Ждём пока определится тип устройства
  if (isMobile === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (isMobile) return <MobileContactsPage />

  // На десктопе — показываем контакты тоже (прокрутка к подвалу)
  return <MobileContactsPage />
}
