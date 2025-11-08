"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, Filter, Package, ShoppingCart } from "lucide-react"
import { getProductsByBrandDetailed, getCategoriesByBrand, getProductsByBrandAndCategory, getAllBrands } from "@/app/actions/public"
import { CategoryData, AllBrandsData, PaginatedBrandProducts } from "@/app/actions/public"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import Image from "next/image"
import Link from "next/link"
import { API_BASE_URL } from "@/lib/api-address"

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
  
  const [brandData, setBrandData] = useState<PaginatedBrandProducts | null>(null)
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {brandData.products.map((product) => {
                  return (
                    <div key={product.id} className="group">
                      <Link href={`/product/${product.slug}`}>
                        <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer bg-white rounded-xl border-0 shadow-lg">
                          <CardContent className="p-3">
                            <div className="relative">
                              {/* Изображение товара */}
                              <div className="aspect-square relative bg-white rounded-lg overflow-hidden mb-3">
                                {product.image_url ? (
                                  <Image
                                    src={getImageUrl(product.image_url)}
                                    alt={product.name}
                                    fill
                                    className="object-contain group-hover:scale-110 transition-transform duration-300"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full">
                                    <div className="text-gray-400 text-2xl">📦</div>
                                  </div>
                                )}
                                
                                {/* Статус товара - верхний левый угол */}
                                {product.status && (
                                  <div className="absolute top-2 left-2 z-10">
                                    <Badge 
                                      className="text-xs px-2 py-1 shadow-md"
                                      style={{
                                        backgroundColor: product.status.background_color,
                                        color: product.status.text_color
                                      }}
                                    >
                                      {product.status.name}
                                    </Badge>
                                  </div>
                                )}
                                
                                {/* Кнопка "В избранное" - только при наведении */}
                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                                  <FavoriteButton
                                    productId={product.id}
                                    productName={product.name}
                                    className="w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-md hover:shadow-lg"
                                    size="sm"
                                  />
                                </div>
                                
                                {/* Панель с дополнительной информацией при наведении - только снизу */}
                                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                                  <div className="p-3 w-full">
                                    {/* Бренд */}
                                    {product.brand_info && (
                                      <div className="text-xs text-white mb-1">
                                        <span className="font-medium">Бренд:</span> {product.brand_info.name}
                                      </div>
                                    )}
                                    {/* Страна */}
                                    {product.brand_info?.country && (
                                      <div className="text-xs text-white mb-1">
                                        <span className="font-medium">Страна:</span> {product.brand_info.country}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Информация о товаре */}
                              <div className="space-y-2">
                                <div className="text-xs text-gray-600">
                                  <span className="font-medium">Товар:</span> {product.name}
                                </div>
                                
                                {product.price && (
                                  <div className="text-xs font-bold text-green-600">
                                    <span className="font-medium">Цена:</span> {product.price.toLocaleString()} тг
                                  </div>
                                )}
                                
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Наличие:</span>{" "}
                                  {product.availability_status ? (
                                    <span
                                      style={{
                                        backgroundColor: product.availability_status.background_color,
                                        color: product.availability_status.text_color,
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        fontSize: "12px"
                                      }}
                                    >
                                      {product.availability_status.status_name}
                                    </span>
                                  ) : (
                                    <span>{product.quantity} шт.</span>
                                  )}
                                </div>
                                
                                {/* Кнопка "Добавить в корзину" */}
                                <AddToCartButton
                                  productId={product.id}
                                  productName={product.name}
                                  className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-xs"
                                  size="sm"
                                />
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </div>
                  )
                })}
              </div>
              {brandData.total_pages >= 1 && (
                <div className="mt-8 space-y-3 flex flex-col items-center justify-center">
                  <p className="text-sm text-gray-600 text-center">
                    Страница {brandData.page} из {brandData.total_pages}
                  </p>
                  {brandData.total_pages > 1 && (
                    <div className="flex flex-wrap gap-2 justify-center">
                      {Array.from({ length: brandData.total_pages }, (_, index) => {
                        const pageNumber = index + 1
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
        <div className="flex flex-wrap gap-4" ref={brandsContainerRef}>
          {visibleBrands.map((brand) => (
            <button 
              key={brand.id} 
              onClick={() => handleBrandChange(brand.name)}
              className="group hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-md h-44 w-44 flex-shrink-0 bg-white rounded-xl"
            >
              <div className="p-0 h-full flex flex-col">
                <div className="relative h-full bg-white rounded-xl overflow-hidden">
                  {brand.image_url ? (
                    <Image
                      src={getImageUrl(brand.image_url)}
                      alt={brand.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-2xl text-gray-400">🏢</div>
                    </div>
                  )}
                  
                  {/* Hover overlay с темной полупрозрачной карточкой */}
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center rounded-xl pointer-events-none">
                    <div className="text-center text-white p-2">
                      <h3 className="font-bold text-sm mb-1 leading-tight">{brand.name}</h3>
                      {brand.country && (
                        <p className="text-white/90 text-xs">{brand.country}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </button>
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
