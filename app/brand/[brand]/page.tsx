"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import MobileBrandPage from "@/components/mobile/mobile-brand-page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Filter, Package, ShoppingCart, ChevronLeft, ChevronRight } from "lucide-react"
import { getProductsByBrandDetailed, getCategoriesByBrand, getProductsByBrandAndCategory, getAllBrands } from "@/app/actions/public"
import { CategoryData, AllBrandsData, PaginatedBrandProducts } from "@/app/actions/public"
import { ProductCard } from "@/components/product-card"
import { BrandCard } from "@/components/brand-card"
import Image from "next/image"
import Link from "next/link"
import { API_BASE_URL } from "@/lib/api-address"
import { formatProductPrice, getRetailPriceClass, getWholesalePriceClass, isWholesaleUser } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { QuickViewButton } from "@/components/quick-view-modal"
import { formatAvailabilityStatusLabel } from "@/lib/availability-status-format"
import { useTrackBrandView } from "@/lib/track-customer-activity"

const PER_PAGE = 20

const formatCategoryName = (name: string) => {
  return name.replace(/\./g, '.\u200B')
}


interface CategoryWithCount extends CategoryData {
  product_count: number
}

export default function BrandPage() {
  const params = useParams()
  const router = useRouter()
  const brandName = decodeURIComponent(params.brand as string)
  const isMobile = useIsMobile()

  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  const isSystemUser = user?.role === "admin" || user?.role === "system"
  
  const [brandData, setBrandData] = useState<PaginatedBrandProducts | null>(null)
  useTrackBrandView(brandData?.brand?.id ?? null, brandData?.brand?.name)
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [allBrands, setAllBrands] = useState<AllBrandsData[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [currentBrandName, setCurrentBrandName] = useState<string>(brandName)
  const [brandsPerStep, setBrandsPerStep] = useState<number>(0)
  const [visibleBrandsCount, setVisibleBrandsCount] = useState<number>(0)
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0)
  const productListRef = useRef<HTMLDivElement | null>(null)
  const brandsContainerRef = useRef<HTMLDivElement | null>(null)

  const scrollToProductsTop = useCallback(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" })
    }
  }, [brandName, currentBrandName])

  const updateBrandsToShow = useCallback(() => {
    if (!brandsContainerRef.current) {
      return
    }

    const containerWidth = brandsContainerRef.current.clientWidth
    if (containerWidth === 0) {
      return
    }

    const cardWidth = 176 // Tailwind w-44 => 11rem => 176px
    const gap = 16 // gap-4 => 1rem => 16px

    const itemsPerRow = Math.max(1, Math.floor((containerWidth + gap) / (cardWidth + gap)))
    const nextPerStep = itemsPerRow * 2
    setBrandsPerStep(nextPerStep)
    setVisibleBrandsCount(prev => {
      if (prev === 0) {
        return Math.min(nextPerStep, allBrands.length)
      }
      const adjusted = Math.max(nextPerStep, prev)
      return Math.min(adjusted, allBrands.length)
    })
  }, [allBrands.length])

  // Загружаем данные бренда и категории
  useEffect(() => {
    const loadBrandData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Загружаем товары, категории и все бренды параллельно
        const [brandDataResult, categoriesResult, allBrandsResult] = await Promise.all([
          getProductsByBrandDetailed(brandName, { page: 1, perPage: PER_PAGE }),
          getCategoriesByBrand(brandName),
          getAllBrands()
        ])
        
        setBrandData(brandDataResult)
        setCategories(categoriesResult.categories)
        setAllBrands(allBrandsResult)
        setTotalProductsCount(brandDataResult.total_count ?? brandDataResult.products.length)
        setVisibleBrandsCount(0)
        setSelectedCategory(null)
        setCurrentBrandName(brandName)
        setVisibleBrandsCount(0)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка")
      } finally {
        setLoading(false)
      }
    }

    if (brandName) {
      loadBrandData()
    }
  }, [brandName])

  useEffect(() => {
    if (allBrands.length === 0) {
      setBrandsPerStep(0)
      setVisibleBrandsCount(0)
      return
    }

    const frame = requestAnimationFrame(() => {
      updateBrandsToShow()
    })

    return () => cancelAnimationFrame(frame)
  }, [allBrands, updateBrandsToShow])

  useEffect(() => {
    const container = brandsContainerRef.current
    if (!container || typeof ResizeObserver === "undefined") {
      return
    }

    const observer = new ResizeObserver(() => {
      updateBrandsToShow()
    })

    observer.observe(container)

    return () => observer.disconnect()
  }, [updateBrandsToShow])

  // Смена бренда без перезагрузки страницы
  const handleBrandChange = async (newBrandName: string) => {
    try {
      setLoading(true)
      setError(null)
      setSelectedCategory(null)
      setVisibleBrandsCount(0)
      setCurrentBrandName(newBrandName)
      
      // Обновляем URL без перезагрузки страницы
      const newUrl = `/brand/${encodeURIComponent(newBrandName)}`
      window.history.pushState({}, '', newUrl)
      
      // Загружаем данные нового бренда
      const [brandDataResult, categoriesResult] = await Promise.all([
        getProductsByBrandDetailed(newBrandName, { page: 1, perPage: PER_PAGE }),
        getCategoriesByBrand(newBrandName)
      ])
      
      setBrandData(brandDataResult)
      setCategories(categoriesResult.categories)
      setTotalProductsCount(brandDataResult.total_count ?? brandDataResult.products.length)
      scrollToProductsTop()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки бренда")
    } finally {
      setLoading(false)
    }
  }

  // Фильтрация по категории (серверная с пагинацией)
  const handleCategoryFilter = async (categoryId: number | null) => {
    try {
      setLoading(true)
      setError(null)
      setSelectedCategory(categoryId)

      const targetBrand = currentBrandName || brandName
      const data = categoryId === null
        ? await getProductsByBrandDetailed(targetBrand, { page: 1, perPage: PER_PAGE })
        : await getProductsByBrandAndCategory(targetBrand, categoryId, { page: 1, perPage: PER_PAGE })

      setBrandData(data)
      if (categoryId === null) {
        setTotalProductsCount(data.total_count ?? data.products.length)
      }
      scrollToProductsTop()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка фильтрации товаров")
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = async (page: number) => {
    if (page < 1) {
      return
    }

    if (brandData && brandData.total_pages && page > brandData.total_pages) {
      return
    }

    if (brandData && page === brandData.page && selectedCategory === brandData.category_id) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      const targetBrand = currentBrandName || brandName
      const data = selectedCategory === null
        ? await getProductsByBrandDetailed(targetBrand, { page, perPage: PER_PAGE })
        : await getProductsByBrandAndCategory(targetBrand, selectedCategory, { page, perPage: PER_PAGE })

      setBrandData(data)
      if (selectedCategory === null) {
        setTotalProductsCount(data.total_count ?? data.products.length)
      }
      scrollToProductsTop()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки страницы товаров")
    } finally {
      setLoading(false)
    }
  }

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

  // ✅ Функция для генерации умной пагинации с многоточием
  const getPaginationPages = (currentPage: number, totalPages: number): (number | string)[] => {
    if (totalPages <= 9) {
      // Если страниц мало, показываем все
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }

    const pages: (number | string)[] = []
    
    if (currentPage <= 5) {
      // В начале: 1 2 3 4 5 6 7 8 9 ... 33
      for (let i = 1; i <= 9; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(totalPages)
    } else if (currentPage >= totalPages - 4) {
      // В конце: 1 ... 25 26 27 28 29 30 31 32 33
      pages.push(1)
      pages.push('...')
      for (let i = totalPages - 8; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // В середине: 1 ... 25 26 27 28 29 30 31 32 33
      pages.push(1)
      pages.push('...')
      // Показываем 9 страниц вокруг текущей (4 слева, текущая, 4 справа)
      for (let i = currentPage - 4; i <= currentPage + 4; i++) {
        pages.push(i)
      }
      pages.push('...')
      pages.push(totalPages)
    }
    
    return pages
  }

  if (loading && !brandData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка товаров бренда...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !brandData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ошибка</h1>
          <p className="text-gray-600">{error || "Бренд не найден"}</p>
          <Button 
            onClick={() => router.back()} 
            className="mt-4"
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Назад
          </Button>
        </div>
      </div>
    )
  }

  const fallbackVisibleCount = brandsPerStep > 0
    ? brandsPerStep
    : Math.min(allBrands.length, 8)

  const effectiveVisibleCount = visibleBrandsCount > 0
    ? Math.min(visibleBrandsCount, allBrands.length)
    : fallbackVisibleCount

  const visibleBrands = allBrands.slice(0, effectiveVisibleCount || allBrands.length)

  const canShowMoreBrands = brandsPerStep > 0 && effectiveVisibleCount < allBrands.length

  if (isMobile) return <MobileBrandPage brandName={brandName} />

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Навигация */}
      <div className="mb-6">
        <button 
          onClick={() => router.back()} 
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span>Назад</span>
        </button>
      </div>

      {/* Заголовок */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Товары бренда {brandData.brand?.name || brandName}
        </h1>
        <p className="text-gray-600">
          Найдено товаров: {brandData.total_count}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Панель фильтров */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Фильтры
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  className="lg:hidden"
                >
                  {showFilters ? 'Скрыть' : 'Показать'}
                </Button>
              </div>
            </CardHeader>
            <CardContent className={`${showFilters ? 'block' : 'hidden'} lg:block`}>
              {/* Категории */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900">Категории</h3>
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`w-full justify-between whitespace-normal break-words h-auto py-2 px-3 gap-3 ${
                      selectedCategory === null 
                        ? "bg-brand-yellow hover:bg-yellow-500 text-black" 
                        : "bg-gray-100 hover:bg-gray-200 text-black"
                    }`}
                    onClick={() => handleCategoryFilter(null)}
                  >
                    <span className="text-left leading-snug">Все категории</span>
                    <Badge variant="secondary" className="shrink-0 self-start">
                      {totalProductsCount}
                    </Badge>
                  </Button>
                  
                  {categories
                    .filter(category => category.product_count > 0)
                    .map((category) => (
                    <Button
                      key={category.id}
                      variant="ghost"
                      size="sm"
                      className={`w-full justify-between whitespace-normal break-words h-auto py-2 px-3 gap-3 ${
                        selectedCategory === category.id 
                          ? "bg-brand-yellow hover:bg-yellow-500 text-black" 
                          : "bg-gray-100 hover:bg-gray-200 text-black"
                      }`}
                      onClick={() => handleCategoryFilter(category.id)}
                    >
                    <span className="text-left leading-snug">
                      {formatCategoryName(category.name)}
                      </span>
                      <Badge variant="secondary" className="shrink-0 self-start">
                        {category.product_count}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Список товаров */}
        <div className="lg:col-span-3" ref={productListRef}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2">Загрузка...</span>
            </div>
          ) : brandData.products.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {brandData.products.map((product) => (
                  <ProductCard key={product.id} product={product as any} />
                ))}
              </div>
              {brandData.total_pages >= 1 && (
                <div className="mt-8 space-y-3 flex flex-col items-center justify-center">
                  <p className="text-sm text-gray-600 text-center">
                    Страница {brandData.page} из {brandData.total_pages}
                  </p>
                  {brandData.total_pages > 1 && (
                    <div className="flex items-center gap-2 justify-center flex-wrap">
                      {/* Кнопка "Назад" */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(brandData.page - 1)}
                        disabled={brandData.page === 1 || loading}
                        className="flex items-center gap-1"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Назад
                      </Button>
                      
                      {/* Номера страниц */}
                      <div className="flex gap-2 justify-center flex-wrap">
                        {getPaginationPages(brandData.page, brandData.total_pages).map((page, index) => {
                          if (page === '...') {
                            return (
                              <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                                ...
                              </span>
                            )
                          }
                          const pageNumber = page as number
                        const isActive = brandData.page === pageNumber
                        return (
                          <Button
                            key={pageNumber}
                            variant={isActive ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNumber)}
                            disabled={loading && isActive}
                            className={isActive ? "bg-brand-yellow hover:bg-yellow-500 text-black" : ""}
                          >
                            {pageNumber}
                          </Button>
                        )
                      })}
                      </div>
                      
                      {/* Кнопка "Вперед" */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(brandData.page + 1)}
                        disabled={brandData.page === brandData.total_pages || loading}
                        className="flex items-center gap-1"
                      >
                        Вперед
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Товары не найдены
              </h3>
              <p className="text-gray-600">
                {selectedCategory 
                  ? "В выбранной категории нет товаров этого бренда"
                  : "У этого бренда пока нет товаров"
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Все бренды */}
      <div className="mt-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Все бренды</h2>
        <div
          className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3"
          ref={brandsContainerRef}
        >
          {visibleBrands.map((brand) => (
            <BrandCard
              key={brand.id}
              brand={brand as any}
              onClick={() => handleBrandChange(brand.name)}
            />
          ))}
        </div>
        {canShowMoreBrands && (
          <div className="mt-6 flex justify-center">
            <Button
              variant="outline"
              onClick={() => setVisibleBrandsCount(prev => Math.min(prev + brandsPerStep, allBrands.length))}
            >
              Показать ещё
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
