"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AdminMode, AdminNavSection } from "@/lib/admin-nav-config"

interface Props {
  isCollapsed: boolean
  onCollapseToggle: () => void
  mode: AdminMode
  onModeChange: (m: AdminMode) => void
  sections: AdminNavSection[]
  activeSectionId: string | null
  onSectionSelect: (sectionId: string) => void
}

/**
 * Шапка админки: [<] [CRM|PosPro Shop] · [разделы...] ... [На сайт].
 * Segmented-переключатель режимов и pill'ы разделов. Раздел с одним
 * пунктом (напр. «Внешний вид → Страницы») по клику ведёт сразу на
 * этот пункт и автоматически сворачивает сайдбар — этим занимается
 * AdminLayout, здесь мы только отдаём наружу id раздела.
 */
export default function AdminHeaderNav({
  isCollapsed,
  onCollapseToggle,
  mode,
  onModeChange,
  sections,
  activeSectionId,
  onSectionSelect,
}: Props) {
  return (
    <div className="sticky top-0 z-40 h-16 flex items-center gap-2 px-3 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 rounded-full hover:bg-gray-100"
        onClick={onCollapseToggle}
        title={isCollapsed ? "Развернуть меню" : "Свернуть меню"}
      >
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      {/* Segmented режим. PosPro Shop — первым, т.к. это дефолтный режим
          при заходе в админку; CRM — вторым. */}
      <div className="shrink-0 grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
        <button
          type="button"
          onClick={() => onModeChange("shop")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
            mode === "shop"
              ? "bg-brand-yellow text-black shadow-[0_2px_6px_rgba(250,204,21,0.35)]"
              : "text-gray-500 hover:text-gray-900",
          )}
        >
          PosPro Shop
        </button>
        <button
          type="button"
          onClick={() => onModeChange("crm")}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
            mode === "crm"
              ? "bg-brand-yellow text-black shadow-[0_2px_6px_rgba(250,204,21,0.35)]"
              : "text-gray-500 hover:text-gray-900",
          )}
        >
          CRM
        </button>
      </div>

      <div className="h-6 w-px bg-gray-200 shrink-0" />

      {/* Pill'ы разделов. Стилистика — такая же, как у пунктов сайдбара
          (navItemClass в admin-sidebar.tsx): rounded-lg, белая карточка с
          лёгкой тенью, hover приподнимает; активная — светло-жёлтая с
          жёлтой рамкой и более выраженной тенью. Горизонтальный скролл
          на узких экранах, scrollbar спрятан. */}
      <div
        className={cn(
          "flex-1 flex items-center gap-1.5 overflow-x-auto py-1",
          "[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]",
        )}
      >
        {sections.map((s) => {
          const active = s.id === activeSectionId
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onSectionSelect(s.id)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap bg-white",
                "transition-all duration-150 ease-out will-change-transform",
                active
                  ? "bg-brand-yellow/25 text-black font-semibold border border-brand-yellow shadow-[0_4px_12px_rgba(250,204,21,0.35)]"
                  : "text-gray-600 border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.10)] hover:-translate-y-[1px] hover:text-gray-900 hover:border-gray-300",
              )}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      <Link
        href="/"
        className={cn(
          "shrink-0 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium",
          "bg-brand-yellow text-black hover:bg-yellow-500 transition-colors shadow-sm hover:shadow-md",
        )}
      >
        <ExternalLink className="h-4 w-4" />
        На сайт
      </Link>
    </div>
  )
}
