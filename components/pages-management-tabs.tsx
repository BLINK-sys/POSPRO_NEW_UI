"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import HeaderInfoTab from "./header-info-tab"
import CatalogVisibilityTab from "./catalog-visibility-tab"
import { PayDeliveryTab, AboutTab, HelpTab } from "./static-page-tab"
import BannersTab from "./banners-tab"
import MainBlocksTab from "./main-blocks-tab"
import CardsTab from "./cards-tab"
import FooterInfoTab from "./footer-info-tab"
import SearchPageTab from "./search-page-tab"

interface SubItem {
  id: string
  label: string
}

interface Section {
  id: string
  label: string
  children?: SubItem[]
}

// Декларативная структура левого меню /admin/pages. «Шапка» — с 5
// подпунктами, остальные — плоские. При клике по разделу с подпунктами
// он раскрывается inline (accordion-стиль в стороне) и автоматически
// выбирается первый подпункт.
const SECTIONS: Section[] = [
  {
    id: "header",
    label: "Шапка",
    children: [
      { id: "header-main", label: "Основное" },
      { id: "catalog-types", label: "Типы каталогов" },
      { id: "pay-delivery", label: "Оплата и доставка" },
      { id: "about", label: "О компании" },
      { id: "help", label: "Помощь" },
    ],
  },
  { id: "banners", label: "Баннеры" },
  { id: "main-blocks", label: "Блоки на главной" },
  { id: "cards", label: "Карточки" },
  { id: "search-page", label: "Страница поиска" },
  { id: "footer-info", label: "Инфо подвала" },
]

const VALID_TOP = new Set(SECTIONS.map((s) => s.id))

export default function PagesManagementTabs() {
  const searchParams = useSearchParams()
  const [top, setTop] = useState<string>("header")
  const [sub, setSub] = useState<string | null>("header-main")

  // Deep-link'и (совместимость со старым flat-Tabs):
  //   ?edit-section-card=<id> → «Карточки»
  //   ?edit-block=<id>        → «Блоки на главной»
  //   ?tab=<name>              → внешний top-level таб
  useEffect(() => {
    if (searchParams.get("edit-section-card")) {
      setTop("cards")
      setSub(null)
      return
    }
    if (searchParams.get("edit-block")) {
      setTop("main-blocks")
      setSub(null)
      return
    }
    const explicit = searchParams.get("tab")
    if (explicit && VALID_TOP.has(explicit)) {
      setTop(explicit)
      const section = SECTIONS.find((s) => s.id === explicit)
      setSub(section?.children?.[0]?.id ?? null)
    }
  }, [searchParams])

  const handleTopClick = (id: string) => {
    setTop(id)
    const section = SECTIONS.find((s) => s.id === id)
    setSub(section?.children?.[0]?.id ?? null)
  }

  // Правая панель: содержимое активного (top, sub) пункта.
  const rightPane = useMemo(() => {
    if (top === "header") {
      switch (sub) {
        case "header-main":
          return <HeaderInfoTab />
        case "catalog-types":
          return <CatalogVisibilityTab />
        case "pay-delivery":
          return <PayDeliveryTab />
        case "about":
          return <AboutTab />
        case "help":
          return <HelpTab />
        default:
          return <HeaderInfoTab />
      }
    }
    switch (top) {
      case "banners":
        return <BannersTab />
      case "main-blocks":
        return <MainBlocksTab />
      case "cards":
        return <CardsTab />
      case "search-page":
        return <SearchPageTab />
      case "footer-info":
        return <FooterInfoTab />
      default:
        return null
    }
  }, [top, sub])

  return (
    <div className="flex gap-6">
      {/* Левое меню разделов */}
      <aside className="w-60 shrink-0 space-y-1">
        {SECTIONS.map((s) => {
          const expanded = top === s.id
          const hasChildren = Boolean(s.children?.length)
          return (
            <div key={s.id}>
              <button
                type="button"
                onClick={() => handleTopClick(s.id)}
                className={cn(
                  "w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium text-left transition-all",
                  expanded
                    ? "bg-brand-yellow text-black shadow-[0_2px_6px_rgba(250,204,21,0.30)] border border-brand-yellow"
                    : "bg-white text-gray-700 border border-gray-200 shadow-[0_1px_3px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_10px_rgba(0,0,0,0.10)] hover:-translate-y-[1px]",
                )}
              >
                <span className="truncate">{s.label}</span>
                {hasChildren &&
                  (expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  ))}
              </button>
              {expanded && hasChildren && (
                <div className="mt-1 ml-3 pl-3 border-l-2 border-brand-yellow/40 space-y-1">
                  {s.children!.map((c) => {
                    const active = sub === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSub(c.id)}
                        className={cn(
                          "w-full text-left rounded-md px-2.5 py-1.5 text-sm transition-all",
                          active
                            ? "bg-brand-yellow/25 text-black font-semibold border border-brand-yellow shadow-[0_2px_6px_rgba(250,204,21,0.20)]"
                            : "text-gray-600 border border-transparent hover:bg-gray-50 hover:border-gray-200",
                        )}
                      >
                        {c.label}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </aside>

      {/* Правая часть — содержимое */}
      <div className="flex-1 min-w-0">{rightPane}</div>
    </div>
  )
}
