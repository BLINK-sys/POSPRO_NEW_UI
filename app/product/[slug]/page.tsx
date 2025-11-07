"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { 
  ArrowLeft, 
  Package, 
  FileText, 
  Download, 
  Star, 
  Info, 
  ShoppingCart,
  ExternalLink,
  Play,
  Image as ImageIcon
} from "lucide-react"
import { getProductBySlug } from "@/app/actions/products"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { ProductAvailabilityBadge } from "@/components/product-availability-badge"
import { getProductAvailabilityStatus, ProductAvailabilityStatus } from "@/app/actions/public"
import Image from "next/image"
import Link from "next/link"
import { API_BASE_URL } from "@/lib/api-address"
import { useAuth } from "@/context/auth-context"


interface ProductDetail {
  id: number
  name: string
  slug: string
  article: string
  price: number
  wholesale_price?: number
  quantity: number
  status?: string
  is_visible: boolean
  country?: string
  brand_id?: number | null
  brand_info?: {
    id: number
    name: string
    country?: string
    description?: string
    image_url?: string
  }
  description?: string
  category_id?: number
  image?: string
  availability_status?: ProductAvailabilityStatus
  characteristics: Array<{
    id: number
    key: string
    value: string
    sort_order: number
    unit_of_measurement?: string
  }>
  media: Array<{
    id: number
    media_type: 'image' | 'video'
    url: string
    order: number
  }>
  documents: Array<{
    id: number
    filename: string
    url: string
    file_type: string
    mime_type: string
  }>
  drivers: Array<{
    id: number
    filename: string
    url: string
    file_type: string
    mime_type: string
  }>
}

export default function ProductPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const slug = params.slug as string
  
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [activeTab, setActiveTab] = useState("description")
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set())
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const [showBrandTooltip, setShowBrandTooltip] = useState(false)
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false)

  // Функция для получения правильного URL изображения
  const getImageUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string' || url.trim() === "") {
      return "/placeholder.svg"
    }
    
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
    if (url.startsWith("/uploads/")) {
      // Сервер обслуживает файлы через /uploads/, а не /disk/
      return `${API_BASE_URL}${url}`
    }
    
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  // Функция для получения URL файла
  const getFileUrl = (url: string): string => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
    // Сервер обслуживает файлы через /uploads/, а не /disk/
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  // Функция для получения YouTube video ID
  const getYouTubeVideoId = (url: string): string | null => {
    const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
    return videoId || null
  }

  // Функция для преобразования YouTube URL в embed URL
  const getYouTubeEmbedUrl = (url: string): string => {
    const videoId = getYouTubeVideoId(url)
    return videoId ? `https://www.youtube.com/embed/${videoId}` : url
  }

  // Функция для получения превью YouTube видео
  const getYouTubeThumbnail = (url: string): string => {
    const videoId = getYouTubeVideoId(url)
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : ''
  }

  // Функция для скачивания файлов без мерцания страницы
  const downloadFile = async (url: string, filename: string) => {
    const fileKey = `${url}-${filename}`
    
    // Проверяем, не скачивается ли уже этот файл
    if (downloadingFiles.has(fileKey)) return
    
    try {
      setDownloadingFiles(prev => new Set(prev).add(fileKey))
      
      // Создаем скрытую ссылку для скачивания
      const link = document.createElement('a')
      const fileUrl = getFileUrl(url)
      link.href = fileUrl
      link.download = filename
      link.style.display = 'none'
      link.style.position = 'absolute'
      link.style.left = '-9999px'
      link.style.top = '-9999px'
      
      console.log('Downloading file:', {
        originalUrl: url,
        finalUrl: fileUrl,
        filename: filename
      })
      
      document.body.appendChild(link)
      link.click()
      
      // Удаляем ссылку после небольшой задержки
      setTimeout(() => {
        if (document.body.contains(link)) {
          document.body.removeChild(link)
        }
        // Убираем состояние загрузки
        setDownloadingFiles(prev => {
          const newSet = new Set(prev)
          newSet.delete(fileKey)
          return newSet
        })
      }, 1000) // Увеличиваем время для лучшего UX
    } catch (error) {
      console.error('Ошибка при скачивании файла:', error)
      // Fallback: открываем в новой вкладке
      window.open(getFileUrl(url), '_blank', 'noopener,noreferrer')
      // Убираем состояние загрузки
      setDownloadingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(fileKey)
        return newSet
      })
    }
  }

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true)
        setError(null)
        
        const productData = await getProductBySlug(slug)
        
        // Если у товара нет страны, подгружаем из brand_info
        if (!productData.country && productData.brand_info?.country) {
          productData.country = productData.brand_info.country
        }
        
        // Получаем статус наличия для товара
        const availabilityStatus = await getProductAvailabilityStatus(productData.quantity)
        
        // Добавляем статус наличия к данным товара
        const productWithStatus = {
          ...productData,
          availability_status: availabilityStatus
        }
        
        setProduct(productWithStatus)
        
        // Устанавливаем первый медиафайл как активный
        if (productData.media.length > 0) {
          setActiveMediaIndex(0)
        }

        // Проверяем, доступен ли текущий активный таб
        const availableTabs = []
        if (productData.characteristics.length > 0) availableTabs.push('characteristics')
        if (productData.documents.length > 0) availableTabs.push('documents')
        if (productData.drivers.length > 0) availableTabs.push('drivers')

        if (availableTabs.length > 0) {
          setActiveTab(availableTabs[0]) // Первый доступный таб
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Произошла ошибка")
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      fetchProduct()
    }
  }, [slug])

  // Получаем медиафайлы товара
  const productMedia = product?.media || []
  const activeMedia = productMedia[activeMediaIndex]
  const productImages = productMedia.filter(m => m.media_type === 'image')
  const productVideos = productMedia.filter(m => m.media_type === 'video')

  // Подсчитываем количество активных табов
  const activeTabsCount = 
    (product?.description && product.description.trim() !== '' ? 1 : 0) +
    (product?.characteristics.length > 0 ? 1 : 0) +
    (product?.documents.length > 0 ? 1 : 0) +
    (product?.drivers.length > 0 ? 1 : 0)

  // Проверяем, может ли пользователь видеть оптовую цену
  const canSeeWholesalePrice = user && (
    (user.role === "admin" || user.role === "system") || 
    (user.role === "client" && (user as any).is_wholesale === true)
  )
  
  // Определяем, показывать ли оптовую цену (показываем если пользователь имеет право и цена существует)
  const showWholesalePrice = canSeeWholesalePrice && product?.wholesale_price !== undefined && product.wholesale_price !== null
  
  // Определяем, есть ли значение оптовой цены (больше 0)
  const hasWholesalePriceValue = product?.wholesale_price && product.wholesale_price > 0
  
  // Определяем цвета цен
  const retailPriceColor = showWholesalePrice && hasWholesalePriceValue ? "text-red-600" : "text-green-600"
  const wholesalePriceColor = "text-green-600"

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Загрузка товара...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Ошибка</h1>
          <p className="text-gray-600">{error || "Товар не найден"}</p>
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

      {/* Родительская карточка для всех элементов */}
      <Card className="p-6 shadow-lg">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Левая колонка - Медиа */}
        <div className="space-y-4">
          {/* Основное медиа */}
          <div className={`relative bg-white rounded-lg overflow-hidden transition-all duration-300 shadow-[0_4px_12px_rgba(0,0,0,0.15)] ${
            activeMedia?.media_type === 'video' ? 'aspect-video' : 'aspect-square'
          }`}>
            {activeMedia ? (
              activeMedia.media_type === 'image' ? (
                <Image
                  src={getImageUrl(activeMedia.url)}
                  alt={product.name}
                  fill
                  className="object-contain"
                />
              ) : activeMedia.media_type === 'video' ? (
                <div className="w-full h-full flex items-center justify-center bg-black">
                  {activeMedia.url.includes('youtube.com') || activeMedia.url.includes('youtu.be') ? (
                    // YouTube видео
                    <iframe
                      src={getYouTubeEmbedUrl(activeMedia.url)}
                      className="w-full h-full max-w-full max-h-full"
                      frameBorder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ aspectRatio: '16/9' }}
                    />
                  ) : (
                    // Обычное видео
                    <video
                      src={getFileUrl(activeMedia.url)}
                      controls
                      className="w-full h-full max-w-full max-h-full object-contain"
                      style={{ aspectRatio: '16/9' }}
                    >
                      Ваш браузер не поддерживает видео.
                    </video>
                  )}
                </div>
              ) : null
            ) : (
              <div className="flex items-center justify-center h-full">
                <ImageIcon className="h-12 w-12 text-gray-400" />
              </div>
            )}

            {/* Навигация по медиа */}
            {productMedia.length > 1 && (
              <>
                <button
                  onClick={() => setActiveMediaIndex(activeMediaIndex === 0 ? productMedia.length - 1 : activeMediaIndex - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setActiveMediaIndex(activeMediaIndex === productMedia.length - 1 ? 0 : activeMediaIndex + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 rounded-full hover:bg-opacity-70 transition-all"
                >
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </button>
              </>
            )}

            {/* Индикатор текущего медиа */}
            {productMedia.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {productMedia.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveMediaIndex(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === activeMediaIndex ? 'bg-white' : 'bg-white bg-opacity-50'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Миниатюры медиа */}
          {productMedia.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {productMedia.map((media, index) => (
                <button
                  key={media.id}
                  onClick={() => setActiveMediaIndex(index)}
                  className={`aspect-square relative bg-white rounded-lg overflow-hidden transition-all duration-200 ${
                    index === activeMediaIndex 
                      ? 'shadow-[-4px_-4px_8px_rgba(0,0,0,0.1)]' 
                      : 'shadow-[4px_4px_8px_rgba(0,0,0,0.1)] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.15)]'
                  }`}
                >
                  {media.media_type === 'image' ? (
                    <Image
                      src={getImageUrl(media.url)}
                      alt={`${product.name} - изображение ${index + 1}`}
                      fill
                      className="object-contain"
                    />
                  ) : media.media_type === 'video' ? (
                    <div className="w-full h-full relative">
                      {media.url.includes('youtube.com') || media.url.includes('youtu.be') ? (
                        // YouTube превью
                        <div className="w-full h-full relative">
                          {!thumbnailErrors.has(media.url) ? (
                            <Image
                              src={getYouTubeThumbnail(media.url)}
                              alt="YouTube превью"
                              fill
                              className="object-contain"
                              onError={() => {
                                setThumbnailErrors(prev => new Set(prev).add(media.url))
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-black flex items-center justify-center">
                              <Play className="h-6 w-6 text-white" />
                            </div>
                          )}
                        </div>
                      ) : (
                        // Видео превью
                        <video
                          src={getFileUrl(media.url)}
                          className="w-full h-full object-contain"
                          muted
                        />
                      )}
                      <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
                        <Play className="h-4 w-4 text-white" />
                      </div>
                    </div>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Правая колонка - Информация о товаре */}
        <div className="space-y-6">
          {/* Название товара */}
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">{product.name}</h1>
          </div>

          {/* Информация о товаре */}
          <div className="space-y-3">
            {product.brand_info && (
              <div className="text-sm text-gray-600 relative">
                <span className="font-medium">Бренд:</span>{" "}
                <Link
                  href={`/brand/${encodeURIComponent(product.brand_info.name)}`}
                  className="inline-block px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md shadow-sm hover:shadow-md transition-all duration-200 text-xs font-medium"
                  onMouseEnter={() => setShowBrandTooltip(true)}
                  onMouseLeave={() => setShowBrandTooltip(false)}
                >
                  {product.brand_info.name}
                </Link>
                
                {/* Кастомная подсказка */}
                {showBrandTooltip && (
                  <div className="absolute z-50 px-3 py-2 bg-white text-black text-xs rounded-lg shadow-lg border border-gray-200 -top-12 left-0 whitespace-nowrap">
                    Посмотрите все товары бренда "{product.brand_info.name}"
                    {/* Стрелка вниз */}
                    <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                  </div>
                )}
              </div>
            )}
            
            {(product.country || product.brand_info?.country) && (
              <div className="text-sm text-gray-600">
                <span className="font-medium">Страна производитель:</span> {product.country || product.brand_info?.country}
              </div>
            )}
            
            {/* Статус наличия */}
            <div className="text-sm text-gray-600">
              <span className="font-medium">Наличие:</span>{" "}
              {product.availability_status ? (
                <span
                  style={{
                    backgroundColor: product.availability_status.background_color,
                    color: product.availability_status.text_color,
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "12px",
                    fontWeight: "500"
                  }}
                >
                  {product.availability_status.status_name}
                </span>
              ) : (
                <span>{product.quantity} шт.</span>
              )}
            </div>
          </div>

          {/* Цены */}
          <div className="pt-2 border-t border-gray-200 space-y-2">
            {product.price > 0 && (
              <div className="text-sm">
                <span className="font-medium">Цена:</span>{" "}
                <span className={retailPriceColor}>
                  {product.price.toLocaleString()} тг
                </span>
              </div>
            )}
            
            {showWholesalePrice && (
              <div className="text-sm">
                <span className="font-medium">Оптовая цена:</span>{" "}
                {hasWholesalePriceValue ? (
                  <span className={wholesalePriceColor}>
                    {product.wholesale_price.toLocaleString()} тг
                  </span>
                ) : (
                  <span className="text-gray-500">не указана</span>
                )}
              </div>
            )}
          </div>

          {/* Описание товара */}
          {product.description && product.description.trim() !== '' && (
            <div className="pt-4 border-t border-gray-200">
              <div className="relative">
                <div 
                  className={`text-gray-700 whitespace-pre-wrap transition-all duration-300 ${
                    isDescriptionExpanded ? '' : 'max-h-24 overflow-hidden'
                  }`}
                >
                  {product.description}
                </div>
                {!isDescriptionExpanded && product.description.length > 200 && (
                  <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent">
                    <div className="flex justify-start items-end h-full pb-2 pl-0">
                      <span
                        onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                        className="text-sm text-black hover:underline transition-colors font-medium cursor-pointer"
                      >
                        Показать описание полностью
                      </span>
                    </div>
                  </div>
                )}
                {isDescriptionExpanded && product.description.length > 200 && (
                  <div className="flex justify-start mt-4">
                    <span
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-sm text-black hover:underline transition-colors font-medium cursor-pointer"
                    >
                      Скрыть описание
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="flex gap-3 pt-4">
            <AddToCartButton
              productId={product.id}
              productName={product.name}
              className="flex-1 bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-3 px-6 rounded-full shadow-md hover:shadow-lg transition-all duration-200"
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              Добавить в корзину
            </AddToCartButton>
            
            <FavoriteButton
              productId={product.id}
              productName={product.name}
              className="flex-shrink-0 border border-gray-200 rounded-full p-3 shadow-md hover:shadow-lg transition-all duration-200"
              variant="ghost"
            />
          </div>

        </div>
        </div>

        {/* Табы с дополнительной информацией - внизу страницы */}
        {activeTabsCount > 0 ? (
          <div className="mt-8 pt-8 border-t border-gray-200">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3 rounded-full shadow-md h-12 p-1">
                {product.characteristics.length > 0 && (
                  <TabsTrigger value="characteristics" className="rounded-full data-[state=active]:shadow-md mx-1">Характеристики</TabsTrigger>
                )}
                {product.documents.length > 0 && (
                  <TabsTrigger value="documents" className="rounded-full data-[state=active]:shadow-md mx-1">Документы</TabsTrigger>
                )}
                {product.drivers.length > 0 && (
                  <TabsTrigger value="drivers" className="rounded-full data-[state=active]:shadow-md mx-1">Драйверы</TabsTrigger>
                )}
              </TabsList>

            <TabsContent value="characteristics" className="mt-4">
              {product.characteristics.length > 0 ? (
                <div className="relative">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
                    {product.characteristics
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((char, index) => (
                        <div key={char.id} className="flex justify-between py-2 border-b border-gray-100 last:border-b-0">
                          <span className="font-medium text-gray-700">{char.key}</span>
                          <span className="text-gray-600">
                            {char.value}
                            {char.unit_of_measurement && (
                              <span className="text-gray-400 ml-1">({char.unit_of_measurement})</span>
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                  <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 transform -translate-x-1/2"></div>
                </div>
              ) : (
                <p className="text-gray-500 italic">Характеристики товара отсутствуют</p>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              {product.documents.length > 0 ? (
                <div className="space-y-3">
                  {product.documents.map((doc) => (
                    <div key={doc.id} className="flex items-start gap-4 p-4 bg-gray-100 rounded-lg shadow-md">
                      {/* Черная карточка с логотипом - 20% ширины, 60% высоты */}
                      <div className="w-1/5 bg-black rounded-lg flex items-center justify-center flex-shrink-0 relative shadow-md" style={{ height: '60%', aspectRatio: '5/3' }}>
                        <Image
                          src="/ui/for_docs_driver.png"
                          alt="Document"
                          fill
                          className="object-contain p-6"
                        />
                      </div>
                      
                      {/* Информация о документе */}
                      <div className="flex-1 flex flex-col">
                        <p className="font-medium text-gray-900 text-lg mb-3">{doc.filename}</p>
                        
                        {/* Кнопка скачать под названием */}
                        <Button
                          onClick={() => downloadFile(doc.url, doc.filename)}
                          disabled={downloadingFiles.has(`${doc.url}-${doc.filename}`)}
                          className="bg-brand-yellow hover:bg-yellow-500 text-black font-medium px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all duration-200 self-start"
                        >
                          {downloadingFiles.has(`${doc.url}-${doc.filename}`) ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                              Скачивание...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Скачать
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">Документы отсутствуют</p>
              )}
            </TabsContent>

            <TabsContent value="drivers" className="mt-4">
              {product.drivers.length > 0 ? (
                <div className="space-y-3">
                  {product.drivers.map((driver) => (
                    <div key={driver.id} className="flex items-start gap-4 p-4 bg-gray-100 rounded-lg shadow-md">
                      {/* Черная карточка с логотипом - 20% ширины, 60% высоты */}
                      <div className="w-1/5 bg-black rounded-lg flex items-center justify-center flex-shrink-0 relative shadow-md" style={{ height: '60%', aspectRatio: '5/3' }}>
                        <Image
                          src="/ui/for_docs_driver.png"
                          alt="Driver"
                          fill
                          className="object-contain p-6"
                        />
                      </div>
                      
                      {/* Информация о драйвере */}
                      <div className="flex-1 flex flex-col">
                        <p className="font-medium text-gray-900 text-lg mb-3">{driver.filename}</p>
                        
                        {/* Кнопка скачать под названием */}
                        <Button
                          onClick={() => downloadFile(driver.url, driver.filename)}
                          disabled={downloadingFiles.has(`${driver.url}-${driver.filename}`)}
                          className="bg-brand-yellow hover:bg-yellow-500 text-black font-medium px-4 py-2 rounded-full shadow-md hover:shadow-lg transition-all duration-200 self-start"
                        >
                          {downloadingFiles.has(`${driver.url}-${driver.filename}`) ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900 mr-2"></div>
                              Скачивание...
                            </>
                          ) : (
                            <>
                              <Download className="h-4 w-4 mr-2" />
                              Скачать
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 italic">Драйверы отсутствуют</p>
              )}
            </TabsContent>
          </Tabs>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
