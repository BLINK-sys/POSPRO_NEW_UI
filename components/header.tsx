"use client"

import React, { useEffect, useState } from "react"
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
  SheetTrigger,
} from "@/components/ui/sheet"
import { User, ShoppingCart, Menu, LogOut, Loader2, ChevronRight, Star, Plus, Minus, Settings, List, X, Grid3X3, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { useCart } from "@/context/cart-context"
import { useCatalogPanel } from "@/context/catalog-panel-context"
import { getCatalogCategories, CategoryData } from "@/app/actions/public"
import { API_BASE_URL } from "@/lib/api-address"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import ProductSearch from "./product-search"
import { Input } from "@/components/ui/input"

export default function Header() {
  const { user, logout, isLoading } = useAuth()
  const { cartCount } = useCart()
  const { toggleCatalogPanel, closeCatalogPanel } = useCatalogPanel()
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [hoveredCategory, setHoveredCategory] = useState<CategoryData | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpandedCategories, setSidebarExpandedCategories] = useState<Set<number>>(new Set())
  const [sidebarExpandedMore, setSidebarExpandedMore] = useState<Set<number>>(new Set())
  const [sidebarViewMode, setSidebarViewMode] = useState<'cards' | 'list'>('cards')
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('')
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<number | null>(null)
  const [subcategoryPanelView, setSubcategoryPanelView] = useState<"list" | "cards">("list")

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
    } else if (sortedCategories.length > 0) {
      setHoveredCategory(sortedCategories[0])
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

  // Функция для подсчета количества вложенных категорий (рекурсивно)
  const countNestedCategories = (category: CategoryData): number => {
    let count = category.children ? category.children.length : 0
    if (category.children) {
      category.children.forEach(child => {
        count += countNestedCategories(child)
      })
    }
    return count
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

  // Отсортированные категории по количеству вложенных (от большего к меньшему)
  const sortedCategories = [...categories].sort((a, b) => {
    const countA = countNestedCategories(a)
    const countB = countNestedCategories(b)
    return countB - countA // От большего к меньшему
  })

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
    if (sidebarViewMode === 'list' && sidebarSearchQuery.trim() && sortedCategories.length > 0) {
      const firstMatch = sortedCategories.find(cat => categoryMatchesSearch(cat, sidebarSearchQuery))
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

  // При открытии меню по умолчанию выделяем первую категорию
  return (
    <header className="bg-white dark:bg-gray-950 shadow-lg sticky top-0 z-50">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-24">
          <Link href="/" className="flex items-center" prefetch={false}>
            <Image 
              src="/ui/big_logo.png" 
              alt="PosPro Logo" 
              width={120} 
              height={40}
              className="h-10 w-auto"
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

          <div className="flex items-center gap-4 flex-1 max-w-2xl mx-8">
            {/* Кнопка бокового меню категорий */}
            <Sheet open={sidebarOpen} onOpenChange={handleSidebarOpen}>
              <SheetTrigger asChild>
                <Button
                  className="bg-brand-yellow text-black hover:bg-yellow-500 rounded-full shadow-md hover:shadow-lg transition-shadow duration-200 w-10 h-10 p-0"
                  size="sm"
                >
                  {categoriesLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <List className="h-5 w-5" />
                  )}
                </Button>
              </SheetTrigger>
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
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Поиск категории..."
                        value={sidebarSearchQuery}
                        onChange={(e) => {
                          setSidebarSearchQuery(e.target.value)
                          setHighlightedCategoryId(null)
                        }}
                        className="pl-10"
                      />
                    </div>
                  )}
                </SheetHeader>
                <div className="p-6">
                  {categoriesLoading ? (
                    <div className="flex items-center justify-center w-full py-8">
                      <Loader2 className="h-6 w-6 animate-spin mr-2" />
                      <span>Загрузка категорий...</span>
                    </div>
                  ) : sortedCategories.length > 0 ? (
                    sidebarViewMode === 'cards' ? (
                      // ВИД 1: Карточки с изображениями
                      <div className="flex flex-col md:flex-row gap-6">
                        {/* Разделяем категории на колонки */}
                        {[0, 1, 2].map((colIndex) => {
                          const categoriesInColumn = sortedCategories.filter((_, index) => index % 3 === colIndex);
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
                      // ВИД 2: Список без изображений и карточек
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {sortedCategories.map((category) => {
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
                              "space-y-2 transition-all duration-200",
                              isHighlighted && "ring-2 ring-brand-yellow ring-offset-2 rounded-lg p-2 bg-yellow-50"
                            )}
                          >
                            <h3 className={cn(
                              "font-semibold text-base mb-2",
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
                                          "text-sm hover:text-brand-yellow transition-colors flex-1",
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
                                                "text-xs hover:text-brand-yellow transition-colors block",
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

            {/* Кнопка панели каталога */}
            <Button
              className="bg-brand-yellow text-black hover:bg-yellow-500 rounded-full shadow-md hover:shadow-lg transition-shadow duration-200 w-10 h-10 p-0"
              size="sm"
              onClick={toggleCatalogPanel}
              title="Открыть каталог"
            >
              {categoriesLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Grid3X3 className="h-5 w-5" />
              )}
            </Button>

            {/* Выпадающее меню каталога для десктопа */}
            <div className="hidden lg:flex">
              <Button
                className={cn(
                  "bg-brand-yellow text-black hover:bg-yellow-500 focus:bg-yellow-500 rounded-full shadow-md hover:shadow-lg transition-shadow duration-200 px-4 py-2 flex items-center gap-2",
                  menuOpen && "bg-yellow-500"
                )}
                onClick={toggleMenu}
                  >
                    {categoriesLoading ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Menu className="h-5 w-5 mr-2" />
                    )}
                    Каталог
              </Button>
            </div>
            {menuOpen && (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
                onClick={toggleMenu}
              >
                <div
                  className="relative flex w-[90vw] max-w-[1400px] h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden"
                  onWheel={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
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
                    <div
                      className="w-[360px] bg-gray-50 p-6 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden"
                      style={{ scrollbarWidth: "none" }}
                    >
                      <h3 className="font-semibold text-gray-800 text-lg mb-4">Категории</h3>
                          <ul className="space-y-2">
                        {sortedCategories.map((category) => {
                          const isActive = hoveredCategory?.id === category.id

                          return (
                              <li key={category.id}>
                                  <Link
                                    href={`/category/${category.slug}`}
                                    className={cn(
                                "relative flex items-center justify-between rounded-xl border px-3 py-3 transition-all shadow-md hover:shadow-lg",
                                isActive
                                  ? "bg-brand-yellow text-black font-semibold border-brand-yellow"
                                  : "bg-white text-gray-800 border-gray-200 hover:bg-brand-yellow/80 hover:text-black hover:border-brand-yellow"
                                    )}
                                    onMouseEnter={() => setHoveredCategory(category)}
                              onClick={handleMenuItemClick}
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
                                  <span className="text-sm font-medium leading-tight">{category.name}</span>
                                  {isActive && (
                                    <span className="text-xs text-gray-600">Товаров: {getCategoryCount(category)}</span>
                                  )}
                                </div>
                              </div>
                              {isActive && (
                                <div className="absolute top-[-1px] right-[-1px] h-8 w-8">
                                  <div className="absolute inset-0 bg-gray-900 rounded-tr-xl rounded-bl-xl"></div>
                                  <ChevronRight className="absolute top-1/2 right-2 -translate-y-1/2 h-3.5 w-3.5 text-white" />
                                </div>
                              )}
                            </Link>
                              </li>
                          )
                        })}
                          </ul>
                        </div>
                  <div
                    className="flex-1 p-6 overflow-y-auto overscroll-contain [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: "none" }}
                  >
                          {hoveredCategory ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                          <h4 className="font-semibold text-gray-800 text-lg">
                                  {hoveredCategory.name}
                                </h4>
                              </div>
                              {hoveredCategory.children && hoveredCategory.children.length > 0 ? (
                                <>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {hoveredCategory.children.map((child) => {
                                const containerClasses =
                                  subcategoryPanelView === "cards"
                                    ? "block"
                                    : "group space-y-2";
                                const childCount = getCategoryCount(child)

                                return (
                                  <div key={child.id} className={containerClasses}>
                                    {subcategoryPanelView === "cards" ? (
                                            <Link 
                                              href={`/category/${child.slug}`}
                                        className="block h-full"
                                        onClick={handleMenuItemClick}
                                      >
                                        <Card className="group h-full w-full overflow-hidden rounded-2xl border-0 shadow-[0_6px_18px_rgba(0,0,0,0.18)] hover:shadow-[0_12px_32px_rgба(0,0,0,0.28)] hover:scale-[1.01] transition-transform duration-300">
                                          <CardContent className="p-0 h-full flex flex-col">
                                            <div className="relative h-[150px] w-full bg-white flex items-center justify-center overflow-hidden">
                                              <Badge className="absolute top-3 right-3 z-10 bg-brand-yellow text-black transition-colors group-hover:bg-gray-900 group-hover:text-white">
                                                {childCount}
                                              </Badge>
                                              {child.image_url ? (
                                                <Image
                                                  src={getImageUrl(child.image_url)}
                                                  alt={child.name}
                                                  fill
                                                  className="object-contain transition-transform duration-300 group-hover:scale-105"
                                                  sizes="150px"
                                                />
                                              ) : (
                                                <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-semibold text-gray-500">
                                                  {child.name.charAt(0).toUpperCase()}
                                                </div>
                                              )}
                                            </div>
                                            <div className="relative bg-brand-yellow text-black font-medium flex items-center justify-between px-4 py-3 rounded-t-2xl rounded-b-2xl mt-auto">
                                              <span className="text-sm leading-tight">{child.name}</span>
                                              <div className="absolute top-0 right-0 w-8 h-full">
                                                <div className="absolute top-0 right-0 h-8 w-8 rounded-tr-2xl bg-gray-900"></div>
                                                <div className="absolute bottom-0 right-0 h-8 w-8 bg-gray-900"></div>
                                                <ChevronRight className="absolute top-1/2 right-2 -translate-y-1/2 h-3.5 w-3.5 text-white" />
                                        </div>
                                    </div>
                                          </CardContent>
                                        </Card>
                                      </Link>
                                    ) : (
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
                                              className="text-sm text-black hover:text-black hover:bg-brand-yellow transition-colors flex-1 py-1 px-2 rounded"
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
                          ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                        <p className="text-sm">Выберите категорию слева для просмотра подкатегорий</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          <div className="hidden md:flex flex-1 items-center">
            <ProductSearch className="w-full" />
          </div>
        </div>

          {/* Мобильная версия поиска */}
          <div className="md:hidden flex-1 mx-4">
            <ProductSearch className="w-full" />
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {user ? (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="bg-brand-yellow hover:bg-yellow-500 text-black font-medium px-4 py-2 rounded-full flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200">
                      <User className="h-5 w-5" />
                      Личный кабинет
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem>
                      <Link href="/profile">Мой профиль</Link>
                    </DropdownMenuItem>
                    {user.role === "client" && (
                      <>
                        <DropdownMenuItem>
                          <Link href="/profile/orders">Заказы</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Link href="/profile/history">История покупок</Link>
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-500 cursor-pointer bg-gray-100 hover:bg-gray-200">
                      <LogOut className="mr-2 h-4 w-4" />
                      Выйти
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {user.role === "admin" ? (
                  <Link href="/admin" className="flex items-center gap-2 bg-brand-yellow text-black hover:bg-yellow-500 hover:text-black px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all duration-200">
                    <Settings className="h-5 w-5" />
                    <span className="text-sm font-medium">Админ панель</span>
                  </Link>
                ) : (
                  <>
                    <Link href="/profile/cart" className="flex flex-col items-center gap-1 relative">
                      <div className="relative">
                        <ShoppingCart className="h-6 w-6 text-gray-700" />
                        {cartCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-brand-yellow text-black text-xs w-5 h-5 rounded-full flex items-center justify-center">
                            {cartCount > 99 ? '99+' : cartCount}
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-gray-700">Корзина</span>
                    </Link>

                    <Link href="/profile/favorites" className="flex flex-col items-center gap-1">
                      <Star className="h-6 w-6 text-gray-700" />
                      <span className="text-sm text-gray-700">Избранное</span>
                    </Link>
                  </>
                )}
              </>
            ) : (
              !isLoading && (
                <Link href="/auth">
                  <Button className="bg-brand-yellow hover:bg-yellow-500 text-black font-medium px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all duration-200">
                    Войти
                  </Button>
                </Link>
              )
            )}
          </div>
        </div>
      </div>
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
