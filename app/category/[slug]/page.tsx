"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { useIsMobile } from "@/hooks/use-mobile"
import MobileCategoryPage from "@/components/mobile/mobile-category-page"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Grid3X3, Package, Tag, Star, Info, Search, Filter, Grid, List, ArrowLeft, ShoppingCart, ChevronRight, ChevronLeft } from "lucide-react"
import { getCategoryData, ProductData, CategoryData } from "@/app/actions/public"
import Image from "next/image"
import Link from "next/link"
import { API_BASE_URL } from "@/lib/api-address"
import { formatProductPrice, getRetailPriceClass, getWholesalePriceClass, isWholesaleUser } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { QuickViewButton } from "@/components/quick-view-modal"
import { ProductCard } from "@/components/product-card"
import { CategoryCard } from "@/components/category-card"
import { formatAvailabilityStatusLabel } from "@/lib/availability-status-format"
import { useTrackCategoryView } from "@/lib/track-customer-activity"

interface CategoryPageData {
  category: CategoryData
  subcategories: CategoryData[]
  products: ProductData[]
  brands?: Array<{
    id: number
    name: string
    country?: string
    description?: string
    image_url?: string
  }>
  pagination?: {
    page: number
    per_page: number
    total_count: number
    total_pages: number
  }
}

const ITEMS_PER_PAGE = 20

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const isMobile = useIsMobile()
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  const isSystemUser = user?.role === "admin" || user?.role === "system"

  const [data, setData] = useState<CategoryPageData | null>(null)
  // Трекинг посещения категории клиентом (бэк сам режет админов и ботов).
  useTrackCategoryView(data?.category?.id, data?.category?.name, data?.category?.slug)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Фильтры
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBrand, setSelectedBrand] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState<string>("name")
  const [currentPage, setCurrentPage] = useState<number>(1)

  // Функция для получения правильного URL изображения
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

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" })
    }
  }, [slug])

  // ✅ СЕРВЕРНАЯ ПАГИНАЦИЯ: Загружаем данные с сервера с учетом фильтров и пагинации
  useEffect(() => {
    const fetchCategoryData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Используем функцию getCategoryData с параметрами пагинации и фильтрации
        const categoryData = await getCategoryData(slug, {
          page: currentPage,
          perPage: ITEMS_PER_PAGE,
          search: searchQuery,
          brand: selectedBrand,
          sort: sortBy
        })
        
        // Преобразуем данные в нужный формат
        const transformedData = {
          category: categoryData.category,
          subcategories: categoryData.children || [],
          products: categoryData.products || [],
          brands: categoryData.brands || [],
          pagination: categoryData.pagination
        }
        
        setData(transformedData)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка")
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchCategoryData()
    }
  }, [slug, currentPage, searchQuery, selectedBrand, sortBy])

  // Обновляем данные при фокусе на окне (когда пользователь возвращается на вкладку)
  useEffect(() => {
    const handleFocus = () => {
      if (slug && !loading) {
        const fetchCategoryData = async () => {
          try {
            setLoading(true)
          setError(null)
          
            const categoryData = await getCategoryData(slug, {
              page: currentPage,
              perPage: ITEMS_PER_PAGE,
              search: searchQuery,
              brand: selectedBrand,
              sort: sortBy
            })
          
          const transformedData = {
            category: categoryData.category,
            subcategories: categoryData.children || [],
              products: categoryData.products || [],
              brands: categoryData.brands || [],
              pagination: categoryData.pagination
          }
          
          setData(transformedData)
          } catch (err) {
            console.error('Error refreshing data:', err)
          } finally {
            setLoading(false)
          }
        }
        
        fetchCategoryData()
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [slug, loading, currentPage, searchQuery, selectedBrand, sortBy])

  // ✅ Получаем уникальные бренды из данных сервера
  const uniqueBrands = data?.brands?.map(b => b.name).sort() || []

  // ✅ Используем товары напрямую с сервера (уже отфильтрованы и отсортированы)
  const paginatedProducts = data?.products || []

  // ✅ Используем пагинацию с сервера
  const totalPages = data?.pagination?.total_pages || 1
  const totalCount = data?.pagination?.total_count || 0

  // При изменении фильтров сбрасываем на первую страницу
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, selectedBrand, sortBy])

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) {
      return
    }
    setCurrentPage(page)
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" })
    }
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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка категории...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ошибка</h1>
          <p className="text-gray-600">{error || "Категория не найдена"}</p>
        </div>
      </div>
    )
  }

  if (isMobile) return <MobileCategoryPage slug={slug} />

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Заголовок категории */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <button 
            onClick={() => router.back()} 
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Назад</span>
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{data.category.name}</h1>
        {data.category.description && (
          <p className="text-gray-600">{data.category.description}</p>
        )}
      </div>

      {/* Панель с товарами */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Товары</h2>
        
        {/* Фильтры и поиск */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Поиск товаров..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300"
                style={{
                  outline: 'none !important',
                  boxShadow: 'none !important',
                  borderColor: 'rgb(209 213 219) !important'
                }}
                onFocus={(e) => {
                  e.target.style.outline = 'none'
                  e.target.style.boxShadow = 'none'
                  e.target.style.borderColor = 'rgb(209 213 219)'
                }}
              />
            </div>
          </div>
          
          <Select
            value={selectedBrand}
            onValueChange={(value) => setSelectedBrand(value)}
          >
             <SelectTrigger 
               className="w-full md:w-48 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300 hover:outline-none hover:ring-0"
               style={{
                 outline: 'none !important',
                 boxShadow: 'none !important',
                 borderColor: 'rgb(209 213 219) !important'
               }}
               onFocus={(e) => {
                 e.target.style.outline = 'none'
                 e.target.style.boxShadow = 'none'
                 e.target.style.borderColor = 'rgb(209 213 219)'
               }}
               onBlur={(e) => {
                 e.target.style.outline = 'none'
                 e.target.style.boxShadow = 'none'
                 e.target.style.borderColor = 'rgb(209 213 219)'
               }}
             >
               <SelectValue placeholder="Все бренды" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Все бренды</SelectItem>
               {uniqueBrands.map((brandName) => (
                 <SelectItem key={brandName} value={brandName}>
                   {brandName}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
          
          <Select
            value={sortBy}
            onValueChange={(value) => {
              setSortBy(value)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger 
              className="w-full md:w-48 rounded-full focus:outline-none focus:ring-0 focus:border-gray-300 hover:outline-none hover:ring-0"
              style={{
                outline: 'none !important',
                boxShadow: 'none !important',
                borderColor: 'rgb(209 213 219) !important'
              }}
              onFocus={(e) => {
                e.target.style.outline = 'none'
                e.target.style.boxShadow = 'none'
                e.target.style.borderColor = 'rgb(209 213 219)'
              }}
              onBlur={(e) => {
                e.target.style.outline = 'none'
                e.target.style.boxShadow = 'none'
                e.target.style.borderColor = 'rgb(209 213 219)'
              }}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">По названию</SelectItem>
              <SelectItem value="price_asc">По цене (возрастание)</SelectItem>
              <SelectItem value="price_desc">По цене (убывание)</SelectItem>
            </SelectContent>
          </Select>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("grid")}
              className={`${
                viewMode === "grid" 
                  ? "bg-brand-yellow hover:bg-yellow-500 text-black" 
                  : "bg-white hover:bg-gray-50 text-black"
              }`}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setViewMode("list")}
              className={`${
                viewMode === "list" 
                  ? "bg-brand-yellow hover:bg-yellow-500 text-black" 
                  : "bg-white hover:bg-gray-50 text-black"
              }`}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Список товаров */}
        {paginatedProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Товары не найдены</h3>
            <p className="text-gray-600">Попробуйте изменить параметры поиска</p>
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3"
                : "space-y-0"
            }
          >
            {paginatedProducts.map((product) => (
              viewMode === "grid" ? (
                <ProductCard key={product.id} product={product as any} />
              ) : (
                <Link key={product.id} href={`/product/${product.slug}`}>
                  <Card className="hover:shadow-md transition-shadow cursor-pointer mb-4">
                    <CardContent className="p-4">
                    <div className="grid grid-cols-7 gap-4 items-center">
                      {/* Изображение */}
                      <div className="w-20 h-20 relative bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <Image
                            src={getImageUrl(product.image_url)}
                            alt={product.name}
                            fill
                            className="object-contain"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="h-8 w-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Наименование */}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-500 mb-1">Наименование</div>
                        <h3 className="font-bold text-gray-900 text-base line-clamp-2">{product.name}</h3>
                        {isSystemUser && product.supplier_name && (
                          <p className="text-xs text-gray-500 mt-0.5 truncate">Поставщик: {product.supplier_name}</p>
                        )}
                      </div>

                      {/* Бренд */}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-500 mb-1">Бренд</div>
                        {product.brand_info?.name ? (
                          <Link href={`/brand/${encodeURIComponent(product.brand_info.name)}`}>
                            <button className="inline-block px-3 py-1 text-base font-bold bg-gray-100 hover:bg-brand-yellow text-black hover:text-black rounded-md shadow-sm hover:shadow-md transition-all duration-200">
                              {product.brand_info.name}
                            </button>
                          </Link>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </div>
                      
                      {/* Наличие */}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-500 mb-1">Наличие</div>
                        {product.availability_status ? (
                          <span
                            className="text-sm font-bold px-2 py-1 rounded"
                            style={{
                              backgroundColor: product.availability_status.background_color,
                              color: product.availability_status.text_color,
                              padding: "3px 8px",
                              borderRadius: "4px",
                              fontSize: "14px"
                            }}
                          >
                            {formatAvailabilityStatusLabel(product.availability_status)}
                          </span>
                        ) : (
                          <span className="text-base font-bold text-gray-500">{product.quantity} шт.</span>
                        )}
                      </div>
                      
                      {/* Цена */}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-500 mb-1">Цена</div>
                        <p className={`text-base font-bold ${getRetailPriceClass(wholesaleUser)}`}>
                          Цена: {formatProductPrice(product.price)}
                        </p>

                        {wholesaleUser && (
                          <p className={`text-base font-bold ${getWholesalePriceClass()}`}>
                            Оптовая цена: {formatProductPrice(product.wholesale_price)}
                          </p>
                        )}
                      </div>
                      
                      {/* Избранное */}
                      <div className="flex justify-center">
                        <FavoriteButton
                          productId={product.id}
                          productName={product.name}
                          className="w-8 h-8 border border-gray-200 rounded-full"
                          variant="ghost"
                          size="sm"
                        />
                      </div>
                      
                                             {/* В корзину */}
                       <div className="flex justify-center">
                         <AddToCartButton
                          productId={product.id}
                          productName={product.name}
                          productSlug={product.slug}
                          productPrice={product.price}
                          productImageUrl={product.image_url}
                          productArticle={product.article || ''}
                          className="bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-4 rounded-lg"
                          size="sm"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              )
            ))}
          </div>
        )}

        {paginatedProducts.length > 0 && (
          <div className="mt-8 space-y-3 flex flex-col items-center justify-center">
            <p className="text-sm text-gray-600 text-center">
              Страница {currentPage} из {totalPages || 1}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 justify-center flex-wrap">
                {/* Кнопка "Назад" */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Назад
                </Button>
                
                {/* Номера страниц */}
                <div className="flex gap-2 justify-center flex-wrap">
                  {getPaginationPages(currentPage, totalPages).map((page, index) => {
                    if (page === '...') {
                      return (
                        <span key={`ellipsis-${index}`} className="px-2 text-gray-500">
                          ...
                        </span>
                      )
                    }
                    const pageNumber = page as number
                  const isActive = currentPage === pageNumber
                  return (
                    <Button
                      key={pageNumber}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNumber)}
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
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="flex items-center gap-1"
                >
                  Вперед
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Вложенные категории */}
      {data.subcategories.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Подкатегории</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {data.subcategories.map((subcategory) => (
              <div key={subcategory.id} className="h-64">
                <CategoryCard category={subcategory as any} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
} 