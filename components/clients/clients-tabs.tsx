"use client"

/**
 * Общая обёртка /admin/clients — табы «Контакты» и «Компании».
 * Активный таб хранится в URL (`?tab=companies`), чтобы back-кнопка
 * вернула юзера в тот же таб после захода в карточку.
 */

import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Users } from "lucide-react"

import { cn } from "@/lib/utils"

import ClientsList from "./clients-list"
import CompaniesList from "./companies-list"

type TabId = "contacts" | "companies"

export default function ClientsTabs() {
  const router = useRouter()
  const params = useSearchParams()
  const activeTab: TabId = params.get("tab") === "companies" ? "companies" : "contacts"

  const setTab = (t: TabId) => {
    const p = new URLSearchParams(params.toString())
    if (t === "contacts") p.delete("tab")
    else p.set("tab", t)
    const qs = p.toString()
    router.replace(qs ? `/admin/clients?${qs}` : "/admin/clients", { scroll: false })
  }

  return (
    <div className="space-y-4 min-w-0">
      {/* Табы в стиле pill-переключателя */}
      <div className="inline-flex items-center bg-gray-100 rounded-full p-1 shrink-0">
        <TabBtn
          icon={<Users className="h-4 w-4" />}
          label="Контакты"
          active={activeTab === "contacts"}
          onClick={() => setTab("contacts")}
        />
        <TabBtn
          icon={<Building2 className="h-4 w-4" />}
          label="Компании"
          active={activeTab === "companies"}
          onClick={() => setTab("companies")}
        />
      </div>

      {activeTab === "contacts" ? <ClientsList /> : <CompaniesList />}
    </div>
  )
}

function TabBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 px-3.5 h-8 text-sm rounded-full transition-all",
        active
          ? "bg-brand-yellow text-black font-medium shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
          : "text-gray-600 hover:text-gray-900",
      )}
    >
      {icon}
      {label}
    </button>
  )
}
