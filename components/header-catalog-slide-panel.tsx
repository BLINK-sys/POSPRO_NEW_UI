"use client"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { CategoryData, getCatalogCategories } from "@/app/actions/public"
import { cn } from "@/lib/utils"
import { ChevronRight, X, Grid3X3, List, Loader2 } from "lucide-react"
import { useCatalogPanel } from "@/context/catalog-panel-context"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getImageUrl } from "@/lib/image-utils"

const HEADER_HEIGHT = 96 // h-24
const BUTTON_HEIGHT = 40 // h-10

export default function HeaderCatalogSlidePanel() {
  const { isCatalogPanelOpen, toggleCatalogPanel, closeCatalogPanel } = useCatalogPanel()
  const pathname = usePathname()
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [hoveredCategory, setHoveredCategory] = useState<CategoryData | null>(null)
  const [subcategoryViewMode, setSubcategoryViewMode] = useState<'cards' | 'list'>('cards')
  const rightColumnRef = useRef<HTMLDivElement>(null)

  // Загрузка категорий
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

  // Закрытие при навигации
  useEffect(() => {
    closeCatalogPanel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Body scroll lock
  useEffect(() => {
    if (isCatalogPanelOpen) {
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
  }, [isCatalogPanelOpen])

  // Скролл правой колонки вверх при смене категории
  useEffect(() => {
    if (rightColumnRef.current) {
      rightColumnRef.current.scrollTo({ top: 0 })
    }
  }, [hoveredCategory])

  const getCategoryCount = (category: CategoryData, { directOnly = false }: { directOnly?: boolean } = {}) => {
    if (directOnly) {
      return category.direct_product_count ?? 0
    }
    return category.product_count ?? category.direct_product_count ?? 0
  }

  const formatCategoryLabel = (category: CategoryData, options?: { directOnly?: boolean }) => {
    const count = getCategoryCount(category, options)
    if (!category.parent_id) {
      return category.name
    }
    return `${category.name} (${count})`
  }

  const handleLinkClick = () => {
    closeCatalogPanel()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-[39] transition-opacity duration-500",
          isCatalogPanelOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        style={{ top: HEADER_HEIGHT }}
        onClick={closeCatalogPanel}
      />

      {/* Clip-контейнер */}
      <div
        className="fixed left-0 right-0 z-40 overflow-hidden"
        style={{
          top: HEADER_HEIGHT,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          pointerEvents: 'none'
        }}
      >
        {/* Скользящий контейнер: панель + кнопка на нижнем краю */}
        <div
          className="flex flex-col transition-transform duration-500 ease-in-out"
          style={{
            height: `calc(100% + ${BUTTON_HEIGHT}px)`,
            transform: isCatalogPanelOpen
              ? 'translateY(0)'
              : `translateY(calc(-100% + ${BUTTON_HEIGHT}px))`
          }}
        >
          {/* Белая панель каталога — на всю высоту viewport */}
          <div
            className="bg-white shadow-none relative"
            style={{
              height: `calc(100vh - ${HEADER_HEIGHT}px)`,
              pointerEvents: isCatalogPanelOpen ? 'auto' : 'none'
            }}
          >
            {categoriesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                <span>Загрузка категорий...</span>
              </div>
            ) : (
              <div className="container mx-auto px-4 md:px-6 h-full">
                <div className="flex gap-8 items-start h-full pt-8 pb-2">
                  {/* Левая колонка — категории (заголовок фиксирован, список скролится) */}
                  <div
                    className="w-64 flex-shrink-0 bg-white rounded-lg shadow-[0_0_8px_rgba(0,0,0,0.15)] flex flex-col self-stretch"
                  >
                    <h2 className="font-bold text-xl py-4 text-gray-900 text-center flex-shrink-0">Категории</h2>
                    <ul
                      className="space-y-2 px-4 pb-4 pt-2 overflow-y-auto [&::-webkit-scrollbar]:hidden flex-1 min-h-0"
                      style={{ scrollbarWidth: 'none' }}
                    >
                      {categories.map((category) => (
                        <li key={category.id}>
                          <button
                            type="button"
                            onClick={() => setHoveredCategory(hoveredCategory?.id === category.id ? null : category)}
                            className={cn(
                              "relative flex items-center justify-between p-3 rounded-lg transition-all duration-200 group w-full text-left",
                              hoveredCategory?.id === category.id
                                ? "bg-brand-yellow text-black font-medium"
                                : "hover:bg-brand-yellow hover:text-black text-gray-700 shadow-[0_0_8px_rgba(0,0,0,0.15)]"
                            )}
                          >
                            <span className={cn(
                              "text-sm flex-1",
                              category.children && category.children.length > 0 ? "pr-14" : ""
                            )}>{formatCategoryLabel(category, { directOnly: true })}</span>
                            {hoveredCategory?.id === category.id && category.children && category.children.length > 0 && (
                              <div className="absolute top-0 right-0 w-8 h-8 bg-gray-900 rounded-tr-lg rounded-bl-lg flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                                <ChevronRight className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Правая колонка — подкатегории (независимый скролл, px-2 для видимости теней) */}
                  <div
                    ref={rightColumnRef}
                    className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden self-stretch px-2 pt-2"
                    style={{ scrollbarWidth: 'none' }}
                  >
                    {hoveredCategory && hoveredCategory.children && hoveredCategory.children.length > 0 ? (
                      <div className="bg-white rounded-lg shadow-[0_0_8px_rgba(0,0,0,0.15)]">
                        {/* Заголовок — z-20 + -top-2 чтобы перекрывать pt-2 зазор и Badge при скролле */}
                        <div className="sticky -top-2 z-20 bg-white rounded-t-lg px-6 pt-8 pb-4 border-b border-gray-200">
                          <div className="flex items-center justify-between gap-4">
                            <h3 className="font-bold text-2xl text-gray-900">{hoveredCategory.name}</h3>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSubcategoryViewMode('cards')}
                                  className={cn(
                                    "px-3 py-2",
                                    subcategoryViewMode === 'cards'
                                      ? "bg-brand-yellow text-black hover:bg-yellow-500"
                                      : "bg-white hover:bg-gray-50"
                                  )}
                                  title="Карточки"
                                >
                                  <Grid3X3 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSubcategoryViewMode('list')}
                                  className={cn(
                                    "px-3 py-2",
                                    subcategoryViewMode === 'list'
                                      ? "bg-brand-yellow text-black hover:bg-yellow-500"
                                      : "bg-white hover:bg-gray-50"
                                  )}
                                  title="Список"
                                >
                                  <List className="h-4 w-4" />
                                </Button>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={closeCatalogPanel}
                                className="px-3 py-2 bg-white hover:bg-gray-50"
                                title="Закрыть каталог"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        {/* Контент с подкатегориями */}
                        <div className="p-6 pt-4">
                          {subcategoryViewMode === 'cards' ? (
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                              {hoveredCategory.children.map((child) => (
                                <Link
                                  key={child.id}
                                  href={`/category/${child.slug}`}
                                  onClick={handleLinkClick}
                                >
                                  <Card className="group hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)] h-64 w-56 flex-shrink-0 bg-white rounded-xl">
                                    <CardContent className="p-0 h-full flex flex-col">
                                      <div className="relative h-48 bg-white flex items-center justify-center rounded-t-xl overflow-hidden p-4">
                                        <Badge className="absolute top-3 right-3 z-10 bg-brand-yellow text-black transition-colors group-hover:bg-gray-900 group-hover:text-white">
                                          {getCategoryCount(child)}
                                        </Badge>
                                        {child.image_url ? (
                                          <div className="relative w-full h-full flex items-center justify-center">
                                            <Image
                                              src={getImageUrl(child.image_url)}
                                              alt={child.name}
                                              fill
                                              className="object-contain group-hover:scale-110 transition-transform duration-300"
                                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            />
                                          </div>
                                        ) : (
                                          <div className="text-4xl text-gray-400">📁</div>
                                        )}
                                      </div>
                                      <div className="relative bg-yellow-400 h-16 rounded-xl p-4 flex items-center justify-between">
                                        <div className="flex-1">
                                          <h3 className="font-bold text-gray-900 text-sm leading-tight">
                                            {child.name}
                                          </h3>
                                          {child.description && (
                                            <p className="text-gray-700 text-xs mt-1 line-clamp-2">
                                              {child.description}
                                            </p>
                                          )}
                                        </div>
                                        <div className="absolute top-0 right-0 w-8 h-8 bg-gray-900 rounded-tr-lg rounded-bl-lg flex items-center justify-center group-hover:bg-gray-700 transition-colors">
                                          <ChevronRight className="w-4 h-4 text-white" />
                                        </div>
                                      </div>
                                    </CardContent>
                                  </Card>
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-4">
                              {hoveredCategory.children.map((child) => (
                                <Link
                                  key={child.id}
                                  href={`/category/${child.slug}`}
                                  onClick={handleLinkClick}
                                  className="text-gray-700 hover:text-brand-yellow transition-colors"
                                >
                                  {formatCategoryLabel(child)}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : hoveredCategory ? (
                      <div className="bg-white rounded-lg p-6 shadow-[0_0_8px_rgba(0,0,0,0.15)] flex items-center justify-center h-full">
                        <div className="text-center">
                          <h3 className="font-bold text-xl text-gray-900 mb-2">{hoveredCategory.name}</h3>
                          <p className="text-gray-500 mb-4">В этой категории нет подкатегорий</p>
                          <Link
                            href={`/category/${hoveredCategory.slug}`}
                            onClick={handleLinkClick}
                            className="inline-block px-6 py-2 bg-brand-yellow text-black rounded-lg hover:bg-yellow-500 transition-colors font-medium"
                          >
                            Посмотреть товары
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-6 shadow-[0_0_8px_rgba(0,0,0,0.15)] flex flex-col items-center justify-center text-center gap-4 h-full">
                        <div className="relative w-48 h-20">
                          <Image
                            src="/ui/big_logo.png"
                            alt="POSPRO"
                            fill
                            className="object-contain"
                            priority
                          />
                        </div>
                        <p className="text-gray-400 text-sm">Нажмите на категорию для просмотра подкатегорий</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Кнопка "Закрыть" — правый нижний угол панели */}
            {isCatalogPanelOpen && (
              <Button
                className="absolute bottom-4 right-6 bg-brand-yellow text-black hover:bg-yellow-500 shadow-md hover:shadow-lg rounded-full px-6 flex items-center gap-2 h-10 cursor-pointer z-10"
                onClick={closeCatalogPanel}
              >
                <X className="h-4 w-4" />
                <span className="text-sm font-medium">Закрыть</span>
              </Button>
            )}
          </div>

          {/* Кнопка "Каталог главная страница" — на нижнем краю панели */}
          <div
            className="flex-shrink-0 flex justify-center"
            style={{ height: BUTTON_HEIGHT, pointerEvents: 'auto' }}
          >
            <Button
              className="bg-brand-yellow text-black hover:bg-yellow-500 !shadow-none !drop-shadow-none rounded-t-none rounded-b-2xl px-6 flex items-center gap-2 h-full cursor-pointer"
              onClick={() => {
                if (!isCatalogPanelOpen) {
                  window.scrollTo({ top: 0, behavior: "smooth" })
                }
                toggleCatalogPanel()
              }}
            >
              {categoriesLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Grid3X3 className="h-5 w-5" />
              )}
              <span className="text-sm font-medium">Каталог главная страница</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
