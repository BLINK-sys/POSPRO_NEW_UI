"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Separator } from '../../../components/ui/separator'
import { ArrowLeft, Filter, Package, ShoppingCart } from "lucide-react"
import { getProductsByBrand, getCategoriesByBrand, getProductsByBrandAndCategory } from '../../../app/actions/public'
import { ProductData, CategoryData } from '../../../app/actions/public'
import { FavoriteButton } from '../../../components/favorite-button'
import { AddToCartButton } from '../../../components/add-to-cart-button'
import { ProductAvailabilityBadge } from '../../../components/product-availability-badge'
import Image from "next/image"
import Link from "next/link"
import { API_BASE_URL } from '../../../lib/api-address'

interface BrandPageData {
  brand: string
  products: ProductData[]
  total_count: number
}

interface CategoryWithCount extends CategoryData {
  product_count: number
}

export default function BrandPage() {
  const params = useParams()
  const router = useRouter()
  const brandName = decodeURIComponent(params.brand as string)
  
  const [brandData, setBrandData] = useState<BrandPageData | null>(null)
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Загружаем данные бренда и категории
  useEffect(() => {
    const loadBrandData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Загружаем товары и категории параллельно
        const [brandDataResult, categoriesResult] = await Promise.all([
          getProductsByBrand(brandName),
          getCategoriesByBrand(brandName)
        ])
        
        setBrandData(brandDataResult)
        setCategories(categoriesResult.categories)
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

  // Фильтрация по категории
  const handleCategoryFilter = async (categoryId: number | null) => {
    try {
      setLoading(true)
      setSelectedCategory(categoryId)
      
      if (categoryId === null) {
        // Показываем все товары бренда
        const data = await getProductsByBrand(brandName)
        setBrandData(data)
      } else {
        // Фильтруем по категории
        const data = await getProductsByBrandAndCategory(brandName, categoryId)
        setBrandData(data)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка фильтрации")
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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'KZT',
      minimumFractionDigits: 0
    }).format(price)
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
          Товары бренда {brandData.brand}
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
                    variant={selectedCategory === null ? "default" : "ghost"}
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => handleCategoryFilter(null)}
                  >
                    Все категории
                    <Badge variant="secondary" className="ml-auto">
                      {brandData.total_count}
                    </Badge>
                  </Button>
                  
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant={selectedCategory === category.id ? "default" : "ghost"}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => handleCategoryFilter(category.id)}
                    >
                      {category.name}
                      <Badge variant="secondary" className="ml-auto">
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
        <div className="lg:col-span-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
              <span className="ml-2">Загрузка...</span>
            </div>
          ) : brandData.products.length > 0 ? (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {brandData.products.map((product) => (
                 <Link key={product.id} href={`/product/${product.slug}`}>
                   <Card className="hover:shadow-md transition-shadow cursor-pointer">
                     <CardContent className="p-4">
                       <div className="group relative">
                         {/* Изображение товара */}
                         <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden mb-3">
                           {product.image_url ? (
                             <Image
                               src={getImageUrl(product.image_url)}
                               alt={product.name}
                               fill
                               className="object-cover group-hover:scale-105 transition-transform duration-300"
                               onError={(e) => {
                                 const target = e.target as HTMLImageElement
                                 target.src = "/placeholder.svg"
                               }}
                             />
                           ) : (
                             <div className="flex items-center justify-center h-full">
                               <div className="text-gray-400 text-4xl">📦</div>
                             </div>
                           )}
                           
                           {/* Кнопка "В избранное" - только при наведении */}
                           <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                             <FavoriteButton
                               productId={product.id}
                               productName={product.name}
                               className="w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-md"
                               size="sm"
                             />
                           </div>
                           
                           {/* Панель с дополнительной информацией при наведении - только снизу */}
                           <div className="absolute bottom-0 left-0 right-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                             <div className="p-3 w-full">
                               {product.brand && typeof product.brand === 'string' && product.brand !== 'no' && (
                                 <div className="text-xs text-white/90 mb-1">
                                   <span className="font-medium">Бренд:</span> {product.brand}
                                 </div>
                               )}
                               <div className="text-xs text-white/90">
                                 <span className="font-medium">Наличие:</span>{" "}
                                 {product.availability_status ? (
                                   <span
                                     style={{
                                       backgroundColor: product.availability_status.background_color,
                                       color: product.availability_status.text_color,
                                       padding: "2px 6px",
                                       borderRadius: "4px",
                                       fontSize: "10px"
                                     }}
                                   >
                                     {product.availability_status.status_name}
                                   </span>
                                 ) : (
                                   <span>{product.quantity} шт.</span>
                                 )}
                               </div>
                             </div>
                           </div>
                         </div>
                         
                         {/* Информация о товаре */}
                         <div className="space-y-2">
                           <div className="text-sm text-gray-600">
                             <span className="font-medium">Товар:</span> {product.name}
                           </div>
                           
                           <div className="text-sm text-gray-600">
                             <span className="font-medium">Цена:</span> {formatPrice(product.price)}
                           </div>
                           
                           {/* Кнопка "Добавить в корзину" */}
                           <AddToCartButton
                             productId={product.id}
                             productName={product.name}
                             className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-4 rounded-lg"
                             size="sm"
                           />
                         </div>
                       </div>
                     </CardContent>
                   </Card>
                 </Link>
               ))}
             </div>
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
    </div>
  )
}
