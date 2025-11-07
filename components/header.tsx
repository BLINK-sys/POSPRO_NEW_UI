"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
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
import { getPublicCategories, CategoryData } from "@/app/actions/public"
import { API_BASE_URL } from "@/lib/api-address"
import ProductSearch from "./product-search"
import { Input } from "@/components/ui/input"

export default function Header() {
  const { user, logout, isLoading } = useAuth()
  const { cartCount } = useCart()
  const { toggleCatalogPanel } = useCatalogPanel()
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [hoveredCategory, setHoveredCategory] = useState<CategoryData | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set())
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpandedCategories, setSidebarExpandedCategories] = useState<Set<number>>(new Set())
  const [sidebarViewMode, setSidebarViewMode] = useState<'cards' | 'list'>('cards')
  const [sidebarSearchQuery, setSidebarSearchQuery] = useState('')
  const [highlightedCategoryId, setHighlightedCategoryId] = useState<number | null>(null)

  useEffect(() => {
    const loadCategories = async () => {
      try {
        setCategoriesLoading(true)
        const data = await getPublicCategories()
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
  const handleMenuEnter = () => setMenuOpen(true)
  const handleMenuLeave = () => {
    setMenuOpen(false)
    setHoveredCategory(null)
    setExpandedSubcategories(new Set())
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
  const handleMenuOpen = () => {
    setMenuOpen(true)
    if (!hoveredCategory && sortedCategories.length > 0) {
      setHoveredCategory(sortedCategories[0])
    }
  }

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
                className="!w-[90vw] !max-w-[90vw] p-0 overflow-y-auto"
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
                                          {category.name}
                                        </Link>
                                      </h3>
                                      {category.children && category.children.length > 0 ? (
                                        <>
                                          <ul className="space-y-2 mb-4">
                                            {category.children.slice(0, 5).map((child) => (
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
                                                    {child.name}
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
                                                          {subChild.name}
                                                        </Link>
                                                      </li>
                                                    ))}
                                                  </ul>
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                          {category.children.length > 5 && (
                                            <Link 
                                              href={`/category/${category.slug}`}
                                              onClick={() => setSidebarOpen(false)}
                                              className="text-sm font-medium text-brand-yellow hover:underline inline-block"
                                            >
                                              Еще {category.children.length - 5} {category.children.length - 5 === 1 ? 'Категория' : category.children.length - 5 < 5 ? 'Категории' : 'Категорий'}
                                            </Link>
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
                                {category.name}
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
                                        {child.name}
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
                                              {subChild.name}
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

            <NavigationMenu className="hidden lg:flex">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger
                    className="bg-brand-yellow text-black hover:bg-yellow-500 focus:bg-yellow-500 data-[active]:bg-yellow-500/90 data-[state=open]:bg-yellow-500/90 rounded-full shadow-md hover:shadow-lg transition-shadow duration-200"
                    onMouseEnter={handleMenuOpen}
                  >
                    {categoriesLoading ? (
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    ) : (
                      <Menu className="h-5 w-5 mr-2" />
                    )}
                    Каталог
                  </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <div
                    className="grid w-[800px] grid-cols-4 gap-0 p-0"
                    onMouseEnter={handleMenuEnter}
                    onMouseLeave={handleMenuLeave}
                  >
                    {categoriesLoading ? (
                      <div className="col-span-4 flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="ml-2">Загрузка категорий...</span>
                      </div>
                    ) : sortedCategories.length > 0 ? (
                      <>
                        {/* Левая колонка с основными категориями */}
                        <div className="col-span-1 bg-gray-50 p-4">
                          <h3 className="font-semibold text-gray-700 mb-4">Категории</h3>
                          <ul className="space-y-2">
                            {sortedCategories.map((category) => (
                              <li key={category.id}>
                                <div className="flex items-center">
                                  <Link
                                    href={`/category/${category.slug}`}
                                    className={cn(
                                      "flex-1 flex items-center justify-between p-2 rounded transition-colors group text-left",
                                      hoveredCategory?.id === category.id
                                        ? "bg-brand-yellow text-black font-medium"
                                        : "hover:bg-brand-yellow hover:text-black text-gray-700"
                                    )}
                                    onMouseEnter={() => setHoveredCategory(category)}
                                  >
                                    <span className={cn("text-sm", hoveredCategory?.id === category.id ? "text-black" : "group-hover:text-black text-gray-700")}>{category.name}</span>
                                    {category.children && category.children.length > 0 && (
                                      <ChevronRight className={cn("h-4 w-4", hoveredCategory?.id === category.id ? "text-black" : "text-gray-400 group-hover:text-black")}/>
                                    )}
                                  </Link>
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                        {/* Правая колонка с подкатегориями */}
                        <div className="col-span-3 p-4 min-h-[300px]">
                          {hoveredCategory ? (
                            <div className="space-y-4">
                              <div className="flex items-center justify-between border-b border-gray-200 pb-2">
                                <h4 className="font-semibold text-gray-800">
                                  {hoveredCategory.name}
                                </h4>
                              </div>
                              {hoveredCategory.children && hoveredCategory.children.length > 0 ? (
                                <>
                                  <div className="flex gap-4">
                                    {/* Левая колонка */}
                                    <div className="flex-1 space-y-2">
                                      {hoveredCategory.children.filter((_, index) => index % 2 === 0).map((child) => (
                                        <div key={child.id} className="group">
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
                                              className="text-sm text-black hover:text-black hover:bg-brand-yellow transition-colors flex-1 py-1 px-2 rounded"
                                            >
                                              {child.name}
                                            </Link>
                                          </div>
                                          {expandedSubcategories.has(child.id) && child.children && child.children.length > 0 && (
                                            <div className="ml-6 mt-2 space-y-1">
                                              {child.children.map((subChild) => (
                                                <div key={subChild.id} className="flex items-center">
                                                  <div className="mr-2">
                                                    <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                                                  </div>
                                                  <Link 
                                                    href={`/category/${subChild.slug}`}
                                                    className="text-xs text-black hover:text-black hover:bg-brand-yellow transition-colors flex-1 py-1 px-2 rounded"
                                                  >
                                                    {subChild.name}
                                                  </Link>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                    
                                    {/* Правая колонка */}
                                    <div className="flex-1 space-y-2">
                                      {hoveredCategory.children.filter((_, index) => index % 2 === 1).map((child) => (
                                        <div key={child.id} className="group">
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
                                              className="text-sm text-black hover:text-black hover:bg-brand-yellow transition-colors flex-1 py-1 px-2 rounded"
                                            >
                                              {child.name}
                                            </Link>
                                          </div>
                                          {expandedSubcategories.has(child.id) && child.children && child.children.length > 0 && (
                                            <div className="ml-6 mt-2 space-y-1">
                                              {child.children.map((subChild) => (
                                                <div key={subChild.id} className="flex items-center">
                                                  <div className="mr-2">
                                                    <div className="w-1.5 h-1.5 bg-black rounded-full"></div>
                                                  </div>
                                                  <Link 
                                                    href={`/category/${subChild.slug}`}
                                                    className="text-xs text-black hover:text-black hover:bg-brand-yellow transition-colors flex-1 py-1 px-2 rounded"
                                                  >
                                                    {subChild.name}
                                                  </Link>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                  {hoveredCategory.children.length > 8 && (
                                    <div className="pt-2 border-t border-gray-200">
                                      <Link 
                                        href={`/category/${hoveredCategory.slug}`}
                                        className="text-sm text-brand-yellow hover:underline transition-colors"
                                      >
                                        Все подкатегории ({hoveredCategory.children.length})
                                      </Link>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="text-center py-8 text-gray-500">
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
                              <p className="text-sm">Наведите на категорию для просмотра подкатегорий</p>
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="col-span-4 text-center py-8 text-gray-500">
                        Категории не найдены
                      </div>
                    )}
                  </div>
                </NavigationMenuContent>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>

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
