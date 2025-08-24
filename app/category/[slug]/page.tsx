"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Grid3X3, Package, Tag, Star, Info, Search, Filter, Grid, List, ArrowLeft, ShoppingCart } from "lucide-react"
import { Category } from "@/app/actions/categories"
import { Product } from "@/app/actions/products"
import { Brand } from "@/app/actions/meta"
import { getCategories } from "@/app/actions/categories"
import { getProducts } from "@/app/actions/products"
import { getBrands } from "@/app/actions/brands"
import { getCategoryData, ProductData } from "@/app/actions/public"
import Image from "next/image"
import Link from "next/link"
import { API_BASE_URL } from "@/lib/api-address"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { ProductAvailabilityBadge } from "@/components/product-availability-badge"

interface CategoryPageData {
  category: Category
  subcategories: Category[]
  products: ProductData[]
  brands: Brand[]
}

export default function CategoryPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  
  const [data, setData] = useState<CategoryPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Фильтры
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBrand, setSelectedBrand] = useState<string>("all")
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [sortBy, setSortBy] = useState<string>("name")

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
    const fetchCategoryData = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Используем функцию getCategoryData, которая обрабатывает статусы наличия
        const categoryData = await getCategoryData(slug)
        
        // Преобразуем данные в нужный формат
        const transformedData = {
          category: categoryData.category,
          subcategories: categoryData.children || [],
          products: categoryData.products || [],
          brands: [] // Бренды будут загружены отдельно, если нужно
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
  }, [slug])

  // Обновляем данные при фокусе на окне (когда пользователь возвращается на вкладку)
  useEffect(() => {
    const handleFocus = () => {
      if (slug && !loading) {
        const fetchCategoryData = async () => {
          try {
            setLoading(true)
            setError(null)
            
            // Используем функцию getCategoryData, которая обрабатывает статусы наличия
            const categoryData = await getCategoryData(slug)
            
            const transformedData = {
              category: categoryData.category,
              subcategories: categoryData.children || [],
              products: categoryData.products || [],
              brands: []
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
  }, [slug, loading])

  const filteredProducts = data?.products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         product.description?.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesBrand = selectedBrand === "all" || !selectedBrand || product.brand?.name === selectedBrand
    return matchesSearch && matchesBrand
  }) || []

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case "name":
        return a.name.localeCompare(b.name)
      case "price_asc":
        return (a.price || 0) - (b.price || 0)
      case "price_desc":
        return (b.price || 0) - (a.price || 0)
      default:
        return 0
    }
  })

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

      {/* Вложенные категории */}
      {data.subcategories.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Подкатегории</h2>
                     <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
             {data.subcategories.map((subcategory) => (
               <Link key={subcategory.id} href={`/category/${subcategory.slug}`}>
                 <Card className="group hover:shadow-lg hover:scale-105 transition-all duration-300 cursor-pointer overflow-hidden border-0 shadow-sm">
                   <CardContent className="p-0">
                     <div className="relative aspect-square">
                       {subcategory.image_url ? (
                         <Image
                           src={getImageUrl(subcategory.image_url)}
                           alt={subcategory.name}
                           fill
                           className="object-cover group-hover:scale-110 transition-transform duration-300"
                         />
                       ) : (
                         <div className="flex items-center justify-center h-full bg-gray-100">
                           <div className="text-2xl">📁</div>
                         </div>
                       )}
                                               {/* Полупрозрачная тёмная карточка с названием */}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-3">
                          <h3 className="font-semibold text-white text-xs text-center">{subcategory.name}</h3>
                          {subcategory.description && (
                            <p className="text-white/80 text-xs mt-1 line-clamp-1 text-center">{subcategory.description}</p>
                          )}
                        </div>
                     </div>
                   </CardContent>
                 </Card>
               </Link>
             ))}
           </div>
        </div>
      )}

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
                className="pl-10"
              />
            </div>
          </div>
          
                     <Select value={selectedBrand} onValueChange={setSelectedBrand}>
             <SelectTrigger className="w-full md:w-48">
               <SelectValue placeholder="Все бренды" />
             </SelectTrigger>
             <SelectContent>
               <SelectItem value="all">Все бренды</SelectItem>
               {data.brands.map((brand) => (
                 <SelectItem key={brand.id} value={brand.name}>
                   {brand.name}
                 </SelectItem>
               ))}
             </SelectContent>
           </Select>
          
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-full md:w-48">
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
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Список товаров */}
        {sortedProducts.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Товары не найдены</h3>
            <p className="text-gray-600">Попробуйте изменить параметры поиска</p>
          </div>
        ) : (
                                                                                       <div className={viewMode === "grid" 
               ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
               : "space-y-0"
             }>
                          {sortedProducts.map((product) => (
                <Link key={product.id} href={`/product/${product.slug}`}>
                  <Card className={`hover:shadow-md transition-shadow cursor-pointer ${viewMode === "list" ? "mb-4" : ""}`}>
                   <CardContent className="p-4">
                                     {viewMode === "grid" ? (
                     // Сетка
                     <div className="group relative">
                                               {/* Изображение товара */}
                        <div className="aspect-square relative bg-gray-100 rounded-lg overflow-hidden mb-3">
                          {product.image_url ? (
                            <Image
                              src={getImageUrl(product.image_url)}
                              alt={product.name}
                              fill
                              className="object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full">
                              <Package className="h-12 w-12 text-gray-400" />
                            </div>
                          )}
                          
                          {/* Статус товара - верхний левый угол */}
                          {product.status && (
                            <div className="absolute top-2 left-2 z-10">
                              <Badge 
                                className="text-xs px-2 py-1"
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
                              className="w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-md"
                              size="sm"
                            />
                          </div>
                          
                          {/* Панель с дополнительной информацией при наведении - только снизу */}
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                            <div className="p-3 w-full">
                              {product.brand && (
                                <div className="text-xs text-white/90 mb-1">
                                  <span className="font-medium">Бренд:</span> {product.brand.name}
                                </div>
                              )}
                              {product.brand?.country && (
                                <div className="text-xs text-white/90 mb-1">
                                  <span className="font-medium">Страна:</span> {product.brand.country}
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
                          
                          {product.price && (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Цена:</span> {product.price.toLocaleString()} тг
                            </div>
                          )}
                          
                          {/* Кнопка "Добавить в корзину" */}
                          <AddToCartButton
                            productId={product.id}
                            productName={product.name}
                            className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-4 rounded-lg"
                            size="sm"
                          />
                        </div>
                       
                       
                     </div>
                                                       ) : (
                    // Список
                    <div className="grid grid-cols-7 gap-4 items-center">
                      {/* Изображение */}
                      <div className="w-20 h-20 relative bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                        {product.image_url ? (
                          <Image
                            src={getImageUrl(product.image_url)}
                            alt={product.name}
                            fill
                            className="object-cover"
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
                        <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</h3>
                      </div>
                      
                      {/* Бренд */}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-500 mb-1">Бренд</div>
                        <p className="text-sm text-gray-900">{product.brand?.name || '-'}</p>
                      </div>
                      
                      {/* Статус */}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-500 mb-1">Статус</div>
                        {product.status ? (
                          <Badge 
                            className="text-xs px-2 py-1"
                            style={{
                              backgroundColor: product.status.background_color,
                              color: product.status.text_color
                            }}
                          >
                            {product.status.name}
                          </Badge>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </div>
                      
                      {/* Цена */}
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-gray-500 mb-1">Цена</div>
                        {product.price ? (
                          <p className="text-sm font-semibold text-gray-900">
                            {product.price.toLocaleString()} тг
                          </p>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
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
                          className="bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-4 rounded-lg"
                          size="sm"
                        />
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
          </div>
        )}
      </div>
    </div>
  )
} 