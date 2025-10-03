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
import { User, ShoppingCart, Menu, LogOut, Loader2, ChevronRight, Star, Plus, Minus, Settings } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { useCart } from "@/context/cart-context"
import { getPublicCategories, CategoryData } from "@/app/actions/public"
import { API_BASE_URL } from "@/lib/api-address"
import ProductSearch from "./product-search"

export default function Header() {
  const { user, logout, isLoading } = useAuth()
  const { cartCount } = useCart()
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(true)
  const [hoveredCategory, setHoveredCategory] = useState<CategoryData | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [expandedSubcategories, setExpandedSubcategories] = useState<Set<number>>(new Set())

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

  // При открытии меню по умолчанию выделяем первую категорию
  const handleMenuOpen = () => {
    setMenuOpen(true)
    if (!hoveredCategory && categories.length > 0) {
      setHoveredCategory(categories[0])
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
                    ) : categories.length > 0 ? (
                      <>
                        {/* Левая колонка с основными категориями */}
                        <div className="col-span-1 bg-gray-50 p-4">
                          <h3 className="font-semibold text-gray-700 mb-4">Категории</h3>
                          <ul className="space-y-2">
                            {categories.map((category) => (
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
                    <Button className="bg-brand-yellow hover:bg-yellow-500 text-black font-medium px-4 py-2 rounded-full flex items-center gap-2">
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
