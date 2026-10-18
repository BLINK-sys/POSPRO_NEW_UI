"use client"

/**
 * Табы раздела «Сделки»: Канбан / История / Источники.
 * «История» и «Источники» видны только owner + can_see_all_deals —
 * это аналитика по всем сделкам, рядовому менеджеру не нужна (он и так
 * видит только свои).
 */

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Briefcase, History, PieChart } from "lucide-react"

import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"


const TABS = [
  { href: "/admin/deals", label: "Канбан", icon: Briefcase, matchExact: true, requiresSeeAll: false },
  { href: "/admin/deals/history", label: "История", icon: History, requiresSeeAll: true },
  { href: "/admin/deals/sources-stats", label: "Источники", icon: PieChart, requiresSeeAll: true },
] as const


export default function DealsTabsHeader() {
  const pathname = usePathname()
  const { user } = useAuth()
  const canSeeAll = Boolean(user && (user.is_owner || user.can_see_all_deals))

  const visibleTabs = TABS.filter((t) => !t.requiresSeeAll || canSeeAll)

  // Если у юзера доступен только один таб — вообще не показываем переключатель
  // (нечего переключать).
  if (visibleTabs.length <= 1) return null

  const isActive = (tab: typeof TABS[number]) => {
    if (tab.matchExact) return pathname === tab.href
    return pathname === tab.href || pathname.startsWith(tab.href + "/")
  }

  return (
    <div className="inline-flex items-center bg-gray-100 rounded-full p-1 shrink-0">
      {visibleTabs.map((tab) => {
        const active = isActive(tab)
        const Icon = tab.icon
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex items-center gap-1.5 px-3.5 h-8 text-sm rounded-full transition-all",
              active
                ? "bg-brand-yellow text-black font-medium shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
                : "text-gray-600 hover:text-gray-900",
            )}
          >
            <Icon className="h-4 w-4" />
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
