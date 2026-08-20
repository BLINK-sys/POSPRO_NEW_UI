"use client"

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { NavigationMenuLink } from "@/components/ui/navigation-menu"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { User, ShoppingCart, Menu, LogOut, Loader2, ChevronRight, ChevronDown as ChevronDownIcon, Star, Plus, Minus, Settings, List, X, Grid3X3, Search, FileText, Sparkles, MonitorSmartphone, MapPin, Phone, Scale } from "lucide-react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { useCart } from "@/context/cart-context"
import { useKP } from "@/context/kp-context"
import { useCompare } from "@/context/compare-context"
import { useCatalogPanel } from "@/context/catalog-panel-context"
import { getCatalogCategories, CategoryData } from "@/app/actions/public"
import { API_BASE_URL } from "@/lib/api-address"
import { measureMaxTextWidth } from "@/lib/measure-text"

// Пункт нижней полосы шапки. Дерево — children рекурсивно.
interface MenuNode {
  id: number
  kind: string
  name: string
  slug: string | null
  border_enabled?: boolean
  border_color?: string | null
  bg_color?: string | null
  text_color?: string | null
  has_children_mode?: boolean
  children?: MenuNode[]
}
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useRouter, usePathname } from "next/navigation"
import HeaderCatalogSlidePanel from "@/components/header-catalog-slide-panel"
import { CategoryCard } from "@/components/category-card"
import HeaderSearch from "@/components/header-search"
import { CatalogTabs, type CatalogTab } from "@/components/catalog-tabs"
import { CatalogDriversView } from "@/components/catalog-drivers-view"

export default function Header() {
  const { user, logout, isLoading } = useAuth()
  const { cartCount } = useCart()
  const { kpCount } = useKP()
  const { count: compareCount } = useCompare()
  const { closeCatalogPanel } = useCatalogPanel()
  const router = useRouter()
  const pathname = usePathname()
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [hoveredCategory, setHoveredCategory] = useState<CategoryData | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpandedCategories, setSidebarExpandedCategories] = useState<Set<number>>(new Set())
  const [sidebarExpandedMore, setSidebarExpandedMore] = useState<Set<number>>(new Set())
  const [sidebarViewMode, setSidebarViewMode] = useState<'cards' | 'list'>('list')
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('')
  const [sidebarTab, setSidebarTab] = useState<CatalogTab>("categories")
  const [menuTab, setMenuTab] = useState<CatalogTab>("categories")

  // Центр main-полосы шапки — под него центруем fixed-язычок бокового
  // каталога. Высота шапки динамическая (top-strip может быть скрыт), поэтому
  // измеряем реальный DOM через ResizeObserver, а не подставляем константу.
  const mainBarRef = useRef<HTMLDivElement>(null)
  const [sidebarBtnTop, setSidebarBtnTop] = useState(48)
  useEffect(() => {
    const el = mainBarRef.current
    if (!el) return
    const update = () => {
      const rect = el.getBoundingClientRect()
      setSidebarBtnTop(rect.top + rect.height / 2)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(document.body)
    window.addEventListener("resize", update)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", update)
    }
  }, [])
  // AI-consultant гейт перееxал на страницу /search (desktop + mobile
  // варианты сами дергают /api/ai-consultant/access).
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<number | null>(null)
  const [subcategoryPanelView, setSubcategoryPanelView] = useState<"list" | "cards">("list")
  const [catalogVisibility, setCatalogVisibility] = useState<{ sidebar: boolean; main: boolean; slide: boolean } | null>(null)

  // Загружаем видимость каталогов (публичный эндпоинт, без авторизации)
  useEffect(() => {
    fetch('/api/public/catalog-visibility')
      .then(r => r.json())
      .then(data => {
        if (data.success && data.visibility) {
          setCatalogVisibility(data.visibility)
        } else {
          setCatalogVisibility({ sidebar: true, main: true, slide: true })
        }
      })
      .catch(() => { setCatalogVisibility({ sidebar: true, main: true, slide: true }) })
  }, [])

  useEffect(() => {
    if (menuOpen) {
      const originalOverflow = document.body.style.overflow
      document.body.style.overflow = "hidden"
      return () => {
        document.body.style.overflow = originalOverflow
      }
    }
    document.body.style.overflow = ""
    return () => {
      document.body.style.overflow = ""
    }
  }, [menuOpen])

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true)
        const data = await getCatalogCategories()
        setCategories(data)
      } catch (error) {
        console.error("Error loading categories:", error)
        setCategories([])
      } finally {
        setCategoriesLoading(false)
      }
    }
    loadCategories()
  }, [])

  // Функция для получения URL изображения
  const getImageUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string' || url.trim() === "") {
      return "/placeholder.svg"
    }
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    if (url.startsWith("/uploads/")) {
      return `${API_BASE_URL}${url}`
    }
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  // Контейнер hover для всего меню
  const toggleMenu = () => {
    setMenuOpen(prev => !prev)
    if (menuOpen) {
      setHoveredCategory(null)
      setExpandedSubcategories(new Set())
    } else if (categories.length > 0) {
      setHoveredCategory(categories[0])
    }
  }

  const handleMenuItemClick = () => {
    setMenuOpen(false)
    setHoveredCategory(null)
    setExpandedSubcategories(new Set())
    closeCatalogPanel()
  }

  const toggleSubcategory = (categoryId: number) => {
    setExpandedSubcategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  const handleSidebarOpen = (open: boolean) => {
    setSidebarOpen(open)
    if (!open) {
      setSidebarExpandedCategories(new Set())
    }
  }

  const toggleSidebarCategory = (categoryId: number) => {
    setSidebarExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  const toggleSidebarMore = (categoryId: number) => {
    setSidebarExpandedMore(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }
      return newSet
    })
  }

  // Функция для проверки, соответствует ли категория поисковому запросу (рекурсивно)
  const categoryMatchesSearch = (category: CategoryData, query: string): boolean => {
    if (!query.trim()) return true
    const lowerQuery = query.toLowerCase()
    if (category.name.toLowerCase().includes(lowerQuery)) return true
    if (category.children) {
      return category.children.some(child => categoryMatchesSearch(child, query))
    }
    return false
  }

  // ✅ Используем порядок категорий с сервера (уже отсортированы по полю order)
  // Не пересортировываем по количеству товаров

  const getCategoryCount = (category: CategoryData): number => {
    if (!category.parent_id) {
      return category.direct_product_count ?? category.product_count ?? 0
    }
    return category.product_count ?? category.direct_product_count ?? 0
  }

  const formatCategoryLabel = (category: CategoryData) => {
    const count = getCategoryCount(category)
    if (!category.parent_id) {
      return category.name
    }
    return `${category.name} (${count})`
  }

  // Прокрутка к первой найденной категории при поиске
  useEffect(() => {
    if (sidebarViewMode === 'list' && sidebarSearchQuery.trim() && categories.length > 0) {
      const firstMatch = categories.find(cat => categoryMatchesSearch(cat, sidebarSearchQuery))
      if (firstMatch) {
        // Небольшая задержка для рендеринга
        setTimeout(() => {
          const element = document.getElementById(`category-${firstMatch.id}`)
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' })
            setHighlightedCategoryId(firstMatch.id)
          }
        }, 100)
      }
    } else {
      setHighlightedCategoryId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sidebarSearchQuery, sidebarViewMode])

  // ── Динамика шапки: strip + menu items + телефон ───────────────
  // Все три источника — публичные endpoint'ы без auth. При редактировании
  // в /admin/pages → Шапка сервер-actions делают revalidateTag('header')
  // + revalidateTag('footer'); Next перезапрашивает данные при следующей
  // навигации. Локально (client fetch) кэша нет — свежие значения приходят
  // при mount'е компонента.
  const [stripData, setStripData] = useState<{
    strip_enabled: boolean; strip_text: string; strip_clickable: boolean;
    strip_url: string; strip_open_new_tab: boolean;
  } | null>(null)
  const [menuItems, setMenuItems] = useState<MenuNode[]>([])
  const [infoBarPhone, setInfoBarPhone] = useState<string>("")

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/public/header`)
      .then(r => r.json())
      .then(data => {
        setStripData(data.strip || null)
        setMenuItems(Array.isArray(data.menu_items) ? data.menu_items : [])
      })
      .catch(() => {})
    fetch(`${API_BASE_URL}/api/footer-settings`)
      .then(r => r.json())
      .then(data => setInfoBarPhone(data.phone || ""))
      .catch(() => {})
  }, [])

  const topStripCloseKey = "pospro:top-strip-closed"
  const [topStripClosed, setTopStripClosed] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined") return
    if (sessionStorage.getItem(topStripCloseKey)) setTopStripClosed(true)
  }, [])
  const closeTopStrip = () => {
    setTopStripClosed(true)
    if (typeof window !== "undefined") sessionStorage.setItem(topStripCloseKey, "1")
  }

  const infoBarLinks: { label: string; href: string }[] = [
    { label: "Оплата и доставка", href: "/pay-delivery" },
    { label: "О компании", href: "/about" },
    { label: "Помощь", href: "/help" },
  ]
  const infoBarCity = "Астана"

  // Пункты нижней полосы — приходят с бэка (admin → Шапка → Разделы).
  // Категории и custom-разделы одинаково ведут на /category/<slug>
  // (fallback на custom section встроен на бэке в public_homepage).
  const topCategories = menuItems

  // Ширина колонки в сайдбар-list = ширина самого длинного пункта
  // (заголовок uppercase + подкатегории + sub-sub). Меряем через canvas
  // при изменении списка категорий.
  const sidebarColumnWidth = useMemo(() => {
    if (!categories.length) return 220
    const labels: string[] = []
    for (const root of categories) {
      labels.push(root.name.toUpperCase())
      for (const c of root.children || []) {
        labels.push(`${c.name} (${getCategoryCount(c)})`)
        for (const s of c.children || []) {
          labels.push(`${s.name} (${getCategoryCount(s)})`)
        }
      }
    }
    const w = measureMaxTextWidth(labels, "600 13px system-ui, -apple-system, sans-serif")
    // +40px = маркер/plus + внутренние отступы; максимум 400px чтобы совсем
    // безумные заголовки не сжирали всю ширину панели.
    return Math.min(400, w + 40)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories])

  return (
    <header className="bg-white dark:bg-gray-950 shadow-lg sticky top-0 z-50 relative">
      {/* ── Полоса 1: строка уведомления (админ → Шапка) ───────────────
          brand-yellow, закрывается на сессию через sessionStorage.
          Кликабельность/target — из настроек. Если strip_clickable=false,
          рендерим span, а не Link — «мёртвый» текст. */}
      {stripData?.strip_enabled && stripData.strip_text && !topStripClosed && (
        <div className="bg-brand-yellow text-black">
          <div className="container mx-auto px-4 md:px-6 flex items-center justify-center gap-3 py-1 text-xs relative">
            {stripData.strip_clickable && stripData.strip_url ? (
              <Link
                href={stripData.strip_url}
                target={stripData.strip_open_new_tab ? "_blank" : undefined}
                rel={stripData.strip_open_new_tab ? "noopener noreferrer" : undefined}
                className="hover:underline font-medium text-center"
              >
                {stripData.strip_text}
              </Link>
            ) : (
              <span className="font-medium text-center">{stripData.strip_text}</span>
            )}
            <button
              type="button"
              onClick={closeTopStrip}
              className="absolute right-2 md:right-4 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-black/10 transition-colors"
              aria-label="Скрыть баннер"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── Полоса 2: город / служебные ссылки / телефон ───────────────── */}
      <div className="hidden md:block border-b border-gray-100 bg-gray-50/70">
        <div className="container mx-auto px-4 md:px-6 flex items-center justify-between h-7 text-[11px] text-gray-600">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-gray-400" />
            <span>{infoBarCity}</span>
          </div>
          <nav className="flex items-center gap-4">
            {infoBarLinks.map(l => (
              <Link key={l.label} href={l.href} className="hover:text-black transition-colors">
                {l.label}
              </Link>
            ))}
          </nav>
          {infoBarPhone && (
            <a href={`tel:${infoBarPhone.replace(/[^\d+]/g, "")}`}
               className="inline-flex items-center gap-1 font-medium text-black hover:text-yellow-700 transition-colors">
              <Phone className="h-3 w-3" />
              {infoBarPhone}
            </a>
          )}
        </div>
      </div>

      {/* Кнопка-язычок бокового каталога — фиксирована на краю панели.
          Под стиль новой шапки: h-8, text-xs, тонкая иконка. Top динамически
          центрируется по main-bar шапки (sidebarBtnTop). */}
      {catalogVisibility?.sidebar && <button
        className="fixed -translate-y-1/2 z-[100] bg-brand-yellow text-black hover:bg-yellow-500 rounded-r-full shadow-md hover:shadow-lg h-8 pl-2 pr-3 flex items-center gap-1.5 text-xs font-medium transition-[left,box-shadow] duration-300 ease-in-out cursor-pointer"
        style={{ left: sidebarOpen ? '90vw' : '0', top: sidebarBtnTop }}
        onClick={() => handleSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? (
          <X className="h-4 w-4" />
        ) : categoriesLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <List className="h-4 w-4" />
        )}
        <span className="hidden sm:inline">Каталог</span>
      </button>}

      <Sheet open={sidebarOpen} onOpenChange={handleSidebarOpen}>
            <SheetContent 
              side="left" 
              className="!w-[90vw] !max-w-[90vw] p-0 overflow-y-auto [&::-webkit-scrollbar]:hidden"
              >
                <SheetHeader className="p-6 border-b sticky top-0 bg-white z-10 shadow-md space-y-4">
                  <div className="flex items-center justify-between">
                    <SheetTitle className="text-left">Каталог</SheetTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant={sidebarViewMode === 'cards' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSidebarViewMode('cards')}
                        className="h-8 w-8 p-0"
                        title="Вид карточек"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={sidebarViewMode === 'list' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSidebarViewMode('list')}
                        className="h-8 w-8 p-0"
                        title="Вид списка"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {sidebarViewMode === 'list' && (
                    <div className="relative">
                      <Input
                        type="text"
                        placeholder="Поиск категории..."
                        value={sidebarSearchQuery}
                        onChange={(e) => {
                          setSidebarSearchQuery(e.target.value)
                          setHighlightedCategoryId(null)
                        }}
                        className="w-full pl-10 pr-10 rounded-full border-gray-300 focus:border-brand-yellow focus:ring-0 focus:ring-offset-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-none shadow-md hover:shadow-lg transition-shadow duration-200"
                        onFocus={(e) => {
                          e.target.style.borderTop = '1px solid #facc15' // Желтая рамка при фокусе
                          e.target.style.borderBottom = '1px solid #facc15'
                          e.target.style.borderLeft = '1px solid #facc15'
                          e.target.style.borderRight = '1px solid #facc15'
                          e.target.style.outline = 'none'
                        }}
                        onBlur={(e) => {
                          e.target.style.borderTop = '1px solid #d1d5db' // Серая рамка без фокуса
                          e.target.style.borderBottom = '1px solid #d1d5db'
                          e.target.style.borderLeft = '1px solid #d1d5db'
                          e.target.style.borderRight = '1px solid #d1d5db'
                        }}
                        style={{ 
                          WebkitAppearance: 'none', 
                          MozAppearance: 'none', 
                          appearance: 'none',
                          outline: 'none',
                          border: '1px solid #d1d5db'
                        }}
                      />
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                      {sidebarSearchQuery && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                          onClick={() => {
                            setSidebarSearchQuery("")
                            setHighlightedCategoryId(null)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                </SheetHeader>
                <CatalogTabs active={sidebarTab} onChange={setSidebarTab} className="px-6" />
                <div className="p-6">
                  {sidebarTab === "drivers" ? (
                    <div className="h-[calc(100vh-260px)]">
                      <CatalogDriversView layout="grid" onItemClick={() => setSidebarOpen(false)} />
                    </div>
                  ) : categoriesLoading ? (
                    <div className="flex items-center justify-center w-full py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Загрузка категорий...</span>
                    </div>
                  ) : categories.length > 0 ? (
                    sidebarViewMode === 'cards' ? (
                      // ВИД 1: Карточки с изображениями
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Разделяем категории на колонки */}
                        {[0, 1, 2].map((colIndex) => {
                          const categoriesInColumn = categories.filter((_, index) => index % 3 === colIndex);
                          return (
                            <div key={colIndex} className="flex-1 flex flex-col gap-6">
                              {categoriesInColumn.map((category) => (
                                <div key={category.id} className="border border-gray-200 rounded-lg p-4 shadow-md hover:shadow-lg transition-shadow bg-white">
                                  <div className="flex gap-4">
                                    {/* Левая колонка - изображение */}
                                    {category.image_url && (
                                      <div className="flex-shrink-0">
                                        <div 
                                          className="w-24 h-24 rounded-lg bg-white p-2 flex items-center justify-center"
                                          style={{
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06), -4px 0 6px -1px rgba(0, 0, 0, 0.1), 4px 0 6px -1px rgba(0, 0, 0, 0.1), 0 -4px 6px -1px rgba(0, 0, 0, 0.1)'
                                          }}
                                        >
                                          <Image
                                            src={getImageUrl(category.image_url)}
                                            alt={category.name}
                                            width={80}
                                            height={80}
                                            className="object-contain rounded-md"
                                            onError={(e) => {
                                              const target = e.target as HTMLImageElement;
                                              target.style.display = 'none';
                                            }}
                                          />
                                        </div>
                                      </div>
                                    )}
                                    {/* Правая колонка - данные категории */}
                                    <div className="flex-1 min-w-0">
                                      <h3 className="font-bold text-lg mb-4 text-gray-900">
                                        <Link 
                                          href={`/category/${category.slug}`}
                                          onClick={() => setSidebarOpen(false)}
                                          className="hover:text-brand-yellow transition-colors"
                                        >
                                          {formatCategoryLabel(category)}
                                        </Link>
                                      </h3>
                                      {category.children && category.children.length > 0 ? (
                                        <>
                                          <ul className="space-y-2 mb-4">
                                            {(sidebarExpandedMore.has(category.id) ? category.children : category.children.slice(0, 5)).map((child) => (
                                              <li key={child.id}>
                                                <div className="flex items-center gap-2">
                                                  {child.children && child.children.length > 0 ? (
                                                    <button
                                                      onClick={() => toggleSidebarCategory(child.id)}
                                                      className={cn(
                                                        "p-1 rounded transition-colors flex items-center justify-center",
                                                        sidebarExpandedCategories.has(child.id)
                                                          ? "bg-black hover:bg-gray-800"
                                                          : "bg-brand-yellow hover:bg-yellow-500"
                                                      )}
                                                    >
                                                      {sidebarExpandedCategories.has(child.id) ? (
                                                        <Minus className="h-3 w-3 text-white" />
                                                      ) : (
                                                        <Plus className="h-3 w-3 text-black" />
                                                      )}
                                                    </button>
                                                  ) : (
                                                    <div className="w-5" />
                                                  )}
                                                  <Link 
                                                    href={`/category/${child.slug}`}
                                                    onClick={() => setSidebarOpen(false)}
                                                    className="text-sm text-gray-700 hover:text-brand-yellow transition-colors flex-1"
                                                  >
                                                    {formatCategoryLabel(child)}
                                                  </Link>
                                                </div>
                                                {sidebarExpandedCategories.has(child.id) && child.children && child.children.length > 0 && (
                                                  <ul className="ml-7 mt-2 space-y-1">
                                                    {child.children.map((subChild) => (
                                                      <li key={subChild.id}>
                                                        <Link 
                                                          href={`/category/${subChild.slug}`}
                                                          onClick={() => setSidebarOpen(false)}
                                                          className="text-xs text-gray-600 hover:text-brand-yellow transition-colors block"
                                                        >
                                                          {formatCategoryLabel(subChild)}
                                                        </Link>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                          {category.children.length > 5 && (
                                            <button
                                              type="button"
                                              onClick={() => toggleSidebarMore(category.id)}
                                              className="text-sm font-medium text-brand-yellow hover:underline inline-block"
                                            >
                                              {sidebarExpandedMore.has(category.id)
                                                ? "Скрыть дополнительные категории"
                                                : `Еще ${category.children.length - 5} ${category.children.length - 5 === 1 ? "категория" : category.children.length - 5 < 5 ? "категории" : "категорий"}`}
                                            </button>
                                          )}
                                        </>
                                      ) : (
                                        <div className="text-sm text-gray-500 mb-4">
                                          Нет подкатегорий
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      // ВИД 2: Список — CSS columns с шириной под самый длинный пункт.
                      // column-width = ширина самого широкого элемента (измерена
                      // через canvas в sidebarColumnWidth), поэтому весь текст
                      // помещается без обрезки, а колонок ровно столько,
                      // сколько влезло по ширине панели.
                      <div style={{ columnWidth: `${sidebarColumnWidth}px`, columnGap: "1.5rem" }}>
                        {[0].map(() => {
                          const categoriesInColumn = categories
                          return (
                            <React.Fragment key="all">
                              {categoriesInColumn.map((category) => {
                          const matchesSearch = sidebarSearchQuery.trim() 
                            ? categoryMatchesSearch(category, sidebarSearchQuery)
                            : true
                          const isHighlighted = highlightedCategoryId === category.id
                          const categoryNameMatches = sidebarSearchQuery.trim()
                            ? category.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
                            : false
                          
                          return (
                          <div
                            key={category.id}
                            id={`category-${category.id}`}
                            className={cn(
                              // break-inside-avoid + inline-block — категория не рвётся
                              // пополам между CSS-колонками; mb-6 = вертикальный gap
                              "space-y-2 transition-all duration-200 break-inside-avoid mb-6 w-full",
                              isHighlighted && "ring-2 ring-brand-yellow ring-offset-2 rounded-lg p-2 bg-yellow-50"
                            )}
                          >
                            <h3 className={cn(
                              "font-semibold text-sm mb-1.5",
                              categoryNameMatches && sidebarSearchQuery.trim()
                                ? "text-brand-yellow font-bold"
                                : "text-gray-900"
                            )}>
                              <Link 
                                href={`/category/${category.slug}`}
                                onClick={() => setSidebarOpen(false)}
                                className="hover:text-brand-yellow transition-colors"
                              >
                                {formatCategoryLabel(category)}
                              </Link>
                            </h3>
                            {category.children && category.children.length > 0 ? (
                              <ul className="space-y-1">
                                {category.children.map((child) => (
                                  <li key={child.id}>
                                    <div className="flex items-center gap-2">
                                      {child.children && child.children.length > 0 ? (
                                        <button
                                          onClick={() => toggleSidebarCategory(child.id)}
                                          className={cn(
                                            "p-1 rounded transition-colors flex items-center justify-center",
                                            sidebarExpandedCategories.has(child.id)
                                              ? "bg-black hover:bg-gray-800"
                                              : "bg-brand-yellow hover:bg-yellow-500"
                                          )}
                                        >
                                          {sidebarExpandedCategories.has(child.id) ? (
                                            <Minus className="h-3 w-3 text-white" />
                                          ) : (
                                            <Plus className="h-3 w-3 text-black" />
                                          )}
                                        </button>
                                      ) : (
                                        <div className="w-5" />
                                      )}
                                      <Link
                                        href={`/category/${child.slug}`}
                                        onClick={() => setSidebarOpen(false)}
                                        className={cn(
                                          "text-xs hover:text-brand-yellow transition-colors flex-1 whitespace-nowrap",
                                          sidebarSearchQuery.trim() && child.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
                                            ? "text-brand-yellow font-bold"
                                            : "text-gray-700"
                                        )}
                                      >
                                        {formatCategoryLabel(child)}
                                      </Link>
                                    </div>
                                    {sidebarExpandedCategories.has(child.id) && child.children && child.children.length > 0 && (
                                      <ul className="ml-7 mt-1 space-y-1">
                                        {child.children.map((subChild) => (
                                          <li key={subChild.id}>
                                            <Link
                                              href={`/category/${subChild.slug}`}
                                              onClick={() => setSidebarOpen(false)}
                                              className={cn(
                                                "text-[11px] hover:text-brand-yellow transition-colors block",
                                                sidebarSearchQuery.trim() && subChild.name.toLowerCase().includes(sidebarSearchQuery.toLowerCase())
                                                  ? "text-brand-yellow font-bold"
                                                  : "text-gray-600"
                                              )}
                                            >
                                              {formatCategoryLabel(subChild)}
                                            </Link>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-xs text-gray-500">
                                Нет подкатегорий
                              </div>
                            )}
                          </div>
                          )
                              })}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div className="w-full text-center py-8 text-gray-500">
                      Категории не найдены
                    </div>
                  )}
                </div>
              </SheetContent>
      </Sheet>

      <div className="container mx-auto px-4 md:px-6">
        <div ref={mainBarRef} className="flex items-center h-12">
          <Link href="/" className="flex items-center flex-shrink-0" prefetch={false}>
            <Image
              src="/ui/big_logo.png"
              alt="PosPro Logo"
              width={120}
              height={40}
              className="h-8 w-auto"
              onError={(e) => {
                console.error("Error loading logo:", e)
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
                const parent = target.parentElement
                if (parent) {
                  parent.innerHTML = '<span class="text-2xl font-bold text-brand-yellow">PosPro</span>'
                }
              }}
            />
          </Link>

          {/* Кнопки каталога / поиска / AI — сразу после логотипа.
              При уменьшении ширины лейблы пропадают (остаются иконки), при
              совсем тесной — кнопки уходят целиком. Каталог самый важный,
              поэтому его лейбл живёт дольше всех. */}
          {catalogVisibility?.main && <div className="hidden lg:flex ml-2 shrink-0">
            <Button
              className={cn(
                "bg-brand-yellow text-black hover:bg-yellow-500 focus:bg-yellow-500 rounded-full shadow-md hover:shadow-lg transition-shadow duration-200 h-8 px-3 text-xs flex items-center gap-1.5",
                menuOpen && "bg-yellow-500"
              )}
              onClick={toggleMenu}
              title="Каталог товаров"
            >
              {categoriesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
              <span className="hidden lg:inline">Каталог</span>
            </Button>
          </div>}

          {/* Инпут поиска с автокомплитом. Ширина ровно под плейсхолдер —
              не растягиваем на всю строку. Иконки справа уедут через
              следующий flex-1 spacer. */}
          <div className="hidden md:flex ml-3 shrink-0">
            <HeaderSearch />
          </div>

          {/* AI consultant теперь живёт на странице /search (справа от кнопки
              поиска, доступ гейтится тем же /api/ai-consultant/access). */}

            {menuOpen && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
                onClick={toggleMenu}
              >
                <div
                  className="relative flex flex-col w-[90vw] max-w-[1400px] h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
                  onWheel={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <CatalogTabs active={menuTab} onChange={setMenuTab} className="border-b bg-white shrink-0" />
                  {menuTab === "drivers" ? (
                    <div className="flex-1 min-h-0">
                      <CatalogDriversView layout="grid" onItemClick={toggleMenu} />
                    </div>
                  ) : (
                  <div className="flex flex-1 min-h-0 overflow-hidden">
                    <div
                      className="w-[360px] flex-shrink-0 bg-gray-50 p-6 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden"
                      style={{ scrollbarWidth: "none" }}
                    >
                          <ul className="space-y-2">
                        {categories.map((category) => {
                          const isActive = hoveredCategory?.id === category.id

                          return (
                              <li key={category.id}>
                                  {/* Клик = выбор категории (toggle), а не переход. Как в
                                      HeaderCatalogSlidePanel. Переход на страницу — только
                                      через явную ссылку «Показать все товары в X» справа. */}
                                  <button
                                    type="button"
                                    className={cn(
                                "w-full text-left relative flex items-center justify-between rounded-xl border px-3 py-3 transition-all shadow-md hover:shadow-lg",
                                isActive
                                  ? "bg-brand-yellow text-black font-semibold border-brand-yellow"
                                  : "bg-white text-gray-800 border-gray-200 hover:bg-brand-yellow/80 hover:text-black hover:border-brand-yellow"
                                    )}
                                    onClick={() => setHoveredCategory(isActive ? null : category)}
                            >
                              <div className="flex items-center gap-3">
                                <div className="relative h-12 w-12 rounded-lg bg-white shadow-inner overflow-hidden flex items-center justify-center">
                                  {category.image_url ? (
                                    <Image
                                      src={getImageUrl(category.image_url)}
                                      alt={category.name}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-semibold text-gray-500">
                                      {category.name.charAt(0).toUpperCase()}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-col min-h-[38px] justify-center">
                                  <span className="text-xs font-medium leading-tight">{category.name}</span>
                                  {isActive && (
                                    <span className="text-[10px] text-gray-600">Товаров: {getCategoryCount(category)}</span>
                                  )}
                                </div>
                              </div>
                              {isActive && (
                                <div className="absolute top-[-1px] right-[-1px] h-8 w-8">
                                  <div className="absolute inset-0 bg-gray-900 rounded-tr-xl rounded-bl-xl"></div>
                                  <ChevronRight className="absolute top-1/2 right-2 -translate-y-1/2 h-3.5 w-3.5 text-white" />
                                </div>
                              )}
                            </button>
                              </li>
                          )
                        })}
                          </ul>
                        </div>
                  <div
                    className="flex-1 flex flex-col overflow-hidden"
                  >
                          {hoveredCategory ? (
                            <>
                              {/* Заголовок с названием категории, кнопками и кнопкой закрытия - зафиксирован при прокрутке */}
                              <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4">
                                <div className="flex items-center justify-between gap-4">
                                  <h4 className="font-semibold text-gray-800 text-lg">
                                    {hoveredCategory.name}
                                  </h4>
                                  <div className="flex items-center gap-2">
                                    {/* Кнопки переключения вида */}
                                    <Button
                                      variant={subcategoryPanelView === "list" ? "default" : "outline"}
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => setSubcategoryPanelView("list")}
                                    >
                                      <List className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant={subcategoryPanelView === "cards" ? "default" : "outline"}
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={() => setSubcategoryPanelView("cards")}
                                    >
                                      <Grid3X3 className="h-4 w-4" />
                                    </Button>
                                    {/* Кнопка закрытия */}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 px-2"
                                      onClick={toggleMenu}
                                      aria-label="Закрыть"
                                    >
                                      <X className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              {/* Контент с подкатегориями */}
                              <div className="flex-1 p-6 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
                                <div className="space-y-4">
                              {hoveredCategory.children && hoveredCategory.children.length > 0 ? (
                                <>
                            <div
                              className={cn(
                                subcategoryPanelView === "cards"
                                  ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"
                                  : "grid gap-x-4 gap-y-1"
                              )}
                              style={
                                subcategoryPanelView === "list"
                                  ? {
                                      // Ширина колонки = ширина самого длинного пункта
                                      // (имя + счётчик + маркер + padding). Меряем через canvas.
                                      gridTemplateColumns: `repeat(auto-fill, minmax(${
                                        (hoveredCategory?.children
                                          ? measureMaxTextWidth(
                                              hoveredCategory.children.map(
                                                (c) => `${c.name} (${getCategoryCount(c)})`
                                              ),
                                              "500 12px system-ui, -apple-system, sans-serif"
                                            )
                                          : 0) + 40
                                      }px, 1fr))`,
                                    }
                                  : undefined
                              }
                            >
                              {hoveredCategory.children.map((child) => {
                                const childCount = getCategoryCount(child)

                                return subcategoryPanelView === "cards" ? (
                                  <div key={child.id} className="aspect-square">
                                    <CategoryCard
                                      category={child}
                                      onClick={handleMenuItemClick}
                                      productCount={childCount}
                                    />
                                  </div>
                                ) : (
                                  <div key={child.id} className="group space-y-2">
                                    {(
                                      <>
                                          <div className="flex items-center">
                                            {child.children && child.children.length > 0 ? (
                                              <button
                                                onClick={(e) => {
                                                  e.preventDefault()
                                                  toggleSubcategory(child.id)
                                                }}
                                                className={`p-1 rounded transition-colors mr-2 ${
  expandedSubcategories.has(child.id)
    ? "bg-black hover:bg-gray-800"
    : "bg-brand-yellow hover:bg-yellow-500"
}`}
                                              >
                                                {expandedSubcategories.has(child.id) ? (
                                                  <Minus className="h-4 w-4 text-white stroke-[3]" />
                                                ) : (
                                                  <Plus className="h-4 w-4 text-black stroke-[3]" />
                                                )}
                                              </button>
                                            ) : (
                                              <div className="mr-2">
                                                <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                                              </div>
                                            )}
                                            <Link
                                              href={`/category/${child.slug}`}
                                            onClick={handleMenuItemClick}
                                              className="text-xs text-black hover:text-black hover:bg-brand-yellow transition-colors flex-1 min-w-0 py-1 px-2 rounded whitespace-nowrap"
                                            >
                                            {child.name} ({childCount})
                                            </Link>
                                          </div>
                                          {expandedSubcategories.has(child.id) && child.children && child.children.length > 0 && (
                                          <div className="ml-6 mt-1 space-y-1">
                                              {child.children.map((subChild) => (
                                                <div key={subChild.id} className="flex items-center">
                                                  <div className="mr-2">
                                                    <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                                                  </div>
                                                  <Link 
                                                    href={`/category/${subChild.slug}`}
                                                  onClick={handleMenuItemClick}
                                                    className="text-xs text-black hover:text-black hover:bg-brand-yellow transition-colors flex-1 py-1 px-2 rounded"
                                                  >
                                                    {subChild.name}
                                                  </Link>
                                                </div>
                                              ))}
                                            </div>
                                        )}
                                      </>
                                          )}
                                        </div>
                                )
                              })}
                                    </div>
                                </>
                              ) : (
                          <div className="text-center py-12 text-gray-500">
                                  <p className="text-sm mb-4">В этой категории нет подкатегорий</p>
                                  <Link 
                                    href={`/category/${hoveredCategory.slug}`}
                                    className="inline-block text-sm text-brand-yellow hover:underline transition-colors"
                                  >
                                    Посмотреть товары в категории
                                  </Link>
                                </div>
                              )}
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                              <p className="text-sm">Выберите категорию слева для просмотра подкатегорий</p>
                            </div>
                          )}
                  </div>
                  </div>
                  )}
                </div>
              </div>
            )}

          {/* Spacer — толкает группу иконок к правому краю */}
          <div className="hidden md:block flex-1" />

          {/* Мобильная версия — кнопка поиска */}
          <div className="md:hidden flex-1 mx-4 flex justify-center">
            <Button
              onClick={() => router.push("/search")}
              className="bg-brand-yellow hover:bg-yellow-500 text-black font-medium px-4 py-2 rounded-full flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200"
            >
              <Search className="h-4 w-4" />
              Найти товар
            </Button>
          </div>

          <div className="flex items-center gap-1 ml-auto shrink-0">
            {/* Сравнение — доступно всем (гостю и авторизованным),
                поэтому кнопка живёт перед развилкой по роли. */}
            <HeaderIconLink
              href="/compare"
              icon={<Scale className="h-4 w-4" />}
              label="Сравнение"
              badge={compareCount > 0 ? String(compareCount) : undefined}
            />
            {user ? (
              <>
                {/* Общий стиль «иконка + подпись под ней» — плоские кнопки
                    вместо dropdown'а профиля, чтобы админ/клиент видел все
                    свои разделы одним взглядом. На md+ подпись видна, на sm
                    скрыта (только иконка + hover-title). */}
                <HeaderIconLink href="/profile" icon={<User className="h-4 w-4" />} label="Профиль" />

                {user.role === "client" && (
                  <>
                    <HeaderIconLink href="/profile/orders" icon={<FileText className="h-4 w-4" />} label="Заказы" />
                    <HeaderIconLink href="/profile/history" icon={<List className="h-4 w-4" />} label="История" />
                    <HeaderIconLink
                      href="/profile/cart"
                      icon={<ShoppingCart className="h-4 w-4" />}
                      label="Корзина"
                      badge={cartCount > 0 ? (cartCount > 99 ? "99+" : String(cartCount)) : undefined}
                    />
                    <HeaderIconLink href="/profile/favorites" icon={<Star className="h-4 w-4" />} label="Избранное" />
                  </>
                )}

                {(user.role === "admin" || user.role === "system") && (
                  <>
                    <HeaderIconLink
                      href="/kp"
                      icon={<FileText className="h-4 w-4" />}
                      label="Собрать КП"
                      badge={kpCount > 0 ? (kpCount > 999 ? "999+" : String(kpCount)) : undefined}
                    />
                    {user.role === "admin" && (
                      <HeaderIconLink
                        href="/admin"
                        icon={<Settings className="h-4 w-4" />}
                        label="Админ"
                      />
                    )}
                  </>
                )}

                <HeaderIconButton
                  onClick={logout}
                  icon={<LogOut className="h-4 w-4" />}
                  label="Выйти"
                  danger
                />
              </>
            ) : (
              !isLoading && (
                <>
                  <HeaderIconLink
                    href="/profile/cart"
                    icon={<ShoppingCart className="h-4 w-4" />}
                    label="Корзина"
                    badge={cartCount > 0 ? (cartCount > 99 ? "99+" : String(cartCount)) : undefined}
                  />
                  <HeaderIconLink
                    href="/auth"
                    icon={<User className="h-4 w-4" />}
                    label="Войти"
                  />
                </>
              )
            )}
          </div>
        </div>

      </div>

      {/* ── Полоса 4: быстрый ряд топ-категорий ──────────────────────── */}
      {topCategories.length > 0 && (
        <div className="hidden md:block border-t border-gray-100 bg-white">
          <div className="container mx-auto px-4 md:px-6 flex items-center gap-1 h-7 overflow-x-auto [&::-webkit-scrollbar]:hidden">
            {topCategories.map(cat => (
              <HeaderMenuNode key={cat.id} node={cat} />
            ))}
          </div>
        </div>
      )}

      {/* Выдвижная панель каталога — только на главной */}
      {pathname === "/" && catalogVisibility?.slide && <HeaderCatalogSlidePanel />}
    </header>
  )
}

const ListItem = React.forwardRef<React.ElementRef<"a">, React.ComponentPropsWithoutRef<"a">>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <li>
        <NavigationMenuLink asChild>
          <a
            ref={ref}
            className={cn(
              "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
              className,
            )}
            {...props}
          >
            <div className="text-sm font-medium leading-none">{title}</div>
            <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">{children}</p>
          </a>
        </NavigationMenuLink>
      </li>
    )
  },
)
ListItem.displayName = "ListItem"


/**
 * Плоская кнопка-«ссылка» с иконкой сверху и подписью снизу — единый
 * визуал всех действий в шапке (Профиль/Корзина/Заказы/КП/Админ/Выйти).
 *
 * `accent` — жёлтый фон для главных действий (Войти, Админ панель).
 * `badge` — маленький счётчик поверх иконки (Корзина, КП).
 */
function HeaderIconLink({
  href, icon, label, badge, accent = false,
}: {
  href: string
  icon: React.ReactNode
  label: string
  badge?: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 h-11 px-2 rounded-lg transition-colors",
        "min-w-[56px]",
        accent
          ? "bg-brand-yellow text-black hover:bg-yellow-500"
          : "text-gray-700 hover:bg-yellow-50 hover:text-black",
      )}
    >
      <span className="relative">
        {icon}
        {badge && (
          <span className="absolute -top-1 -right-2 bg-brand-yellow text-black text-[10px] leading-none font-medium min-w-4 h-4 px-1 rounded-full inline-flex items-center justify-center shadow ring-1 ring-white">
            {badge}
          </span>
        )}
      </span>
      <span className="hidden md:inline text-[10px] leading-tight">{label}</span>
    </Link>
  )
}

/** То же что HeaderIconLink, но кнопка с onClick (для Выйти). `danger` — красный hover. */
function HeaderIconButton({
  onClick, icon, label, danger = false,
}: {
  onClick: () => void
  icon: React.ReactNode
  label: string
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={cn(
        "relative flex flex-col items-center justify-center gap-0.5 h-11 px-2 rounded-lg transition-colors",
        "min-w-[56px]",
        danger
          ? "text-gray-500 hover:bg-red-50 hover:text-red-600"
          : "text-gray-700 hover:bg-yellow-50 hover:text-black",
      )}
    >
      {icon}
      <span className="hidden md:inline text-[10px] leading-tight">{label}</span>
    </button>
  )
}

// ── Пункт нижней полосы шапки: ссылка ИЛИ dropdown с вложенными ──────
// Для has_children_mode отображается кнопка с ▾, клик разворачивает
// dropdown с nested-детьми. Рекурсивно (внуки тоже могут быть nested).
// Клик вне зоны или Escape — закрывает. Стили (bg/text/border) применяются
// inline из настроек пункта — как для обычных ссылок так и для кнопки-триггера.

function nodeButtonStyle(node: MenuNode): React.CSSProperties {
  return {
    backgroundColor: node.bg_color || undefined,
    color: node.text_color || undefined,
    border: node.border_enabled ? `1px solid ${node.border_color || "#facc15"}` : undefined,
  }
}
function nodeButtonCls(node: MenuNode): string {
  const custom = node.bg_color || node.text_color || node.border_enabled
  return cn(
    "whitespace-nowrap px-2 py-0.5 text-[11px] rounded-full transition-colors inline-flex items-center gap-0.5",
    custom
      ? "hover:opacity-80"
      : "text-gray-700 hover:text-black hover:bg-yellow-50",
  )
}

function HeaderMenuNode({ node }: { node: MenuNode }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null)
  const btnRef = React.useRef<HTMLButtonElement>(null)
  const dropRef = React.useRef<HTMLDivElement>(null)
  const isDropdown = !!(node.has_children_mode && node.children && node.children.length > 0)

  // Пересчёт позиции dropdown при open + окне resize/scroll — иначе
  // фикс-меню не следует за кнопкой (кнопка sticky в шапке).
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return
    const upd = () => {
      const r = btnRef.current!.getBoundingClientRect()
      setCoords({ left: r.left, top: r.bottom + 4 })
    }
    upd()
    window.addEventListener("scroll", upd, true)
    window.addEventListener("resize", upd)
    return () => {
      window.removeEventListener("scroll", upd, true)
      window.removeEventListener("resize", upd)
    }
  }, [open])

  // Клик вне (проверяем И кнопку И сам dropdown — он в портале, вне
  // родителя) + Escape закрывают меню
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (btnRef.current?.contains(t)) return
      if (dropRef.current?.contains(t)) return
      setOpen(false)
    }
    const kh = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", h)
    document.addEventListener("keydown", kh)
    return () => {
      document.removeEventListener("mousedown", h)
      document.removeEventListener("keydown", kh)
    }
  }, [open])

  // Обычный пункт (без children) — просто ссылка
  if (!isDropdown) {
    if (!node.slug) return null
    return (
      <Link
        href={`/category/${node.slug}`}
        style={nodeButtonStyle(node)}
        className={nodeButtonCls(node)}
      >
        {node.name}
      </Link>
    )
  }

  // Пункт-dropdown. Меню рендерим через Portal в body, чтобы не клипало
  // overflow-x-auto у родительской полосы. По умолчанию стрелка вниз (▼),
  // при open — переворачивается вверх (▲).
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(o => !o)}
        style={nodeButtonStyle(node)}
        className={nodeButtonCls(node)}
      >
        {node.name}
        <ChevronDownIcon className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && coords && typeof document !== "undefined" && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", left: coords.left, top: coords.top, zIndex: 100 }}
          className="min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-xl py-1"
        >
          {node.children!.map((c) => (
            <NestedItem key={c.id} node={c} onNavigate={() => setOpen(false)} />
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

function NestedItem({ node, onNavigate }: { node: MenuNode; onNavigate: () => void }) {
  const [open, setOpen] = useState(false)
  const isDropdown = !!(node.has_children_mode && node.children && node.children.length > 0)

  if (!isDropdown) {
    if (!node.slug) return null
    return (
      <Link
        href={`/category/${node.slug}`}
        onClick={onNavigate}
        style={nodeButtonStyle(node)}
        className={cn(
          "block px-3 py-1.5 text-xs transition-colors",
          !node.bg_color && !node.text_color && "text-gray-700 hover:text-black hover:bg-yellow-50",
        )}
      >
        {node.name}
      </Link>
    )
  }
  return (
    <div className="relative group">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={nodeButtonStyle(node)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors",
          !node.bg_color && !node.text_color && "text-gray-700 hover:text-black hover:bg-yellow-50",
        )}
      >
        <span>{node.name}</span>
        <ChevronRight className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div className="absolute left-full top-0 ml-0.5 min-w-[200px] bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-[81]">
          {node.children!.map((c) => (
            <NestedItem key={c.id} node={c} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  )
}
