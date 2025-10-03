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
  brand?: string
  description?: string
  category_id?: number
  image?: string
  availability_status?: ProductAvailabilityStatus
  characteristics: Array<{
    id: number
    key: string
    value: string
    sort_order: number
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
  const slug = params.slug as string
  
  const [product, setProduct] = useState<ProductDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [activeTab, setActiveTab] = useState("description")
  const [thumbnailErrors, setThumbnailErrors] = useState<Set<string>>(new Set())
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const [showBrandTooltip, setShowBrandTooltip] = useState(false)

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

  // Функция для получения URL файла
  const getFileUrl = (url: string): string => {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      return url
    }
    
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
      link.href = getFileUrl(url)
      link.download = filename
      link.style.display = 'none'
      link.style.position = 'absolute'
      link.style.left = '-9999px'
      link.style.top = '-9999px'
      
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
        if (productData.description && productData.description.trim() !== '') availableTabs.push('description')
        if (productData.characteristics.length > 0) availableTabs.push('characteristics')
        if (productData.documents.length > 0) availableTabs.push('documents')
        if (productData.drivers.length > 0) availableTabs.push('drivers')

        if (!availableTabs.includes(activeTab) && availableTabs.length > 0) {
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Левая колонка - Медиа */}
        <div className="space-y-4">
          {/* Основное медиа */}
          <div className={`relative bg-gray-100 rounded-lg overflow-hidden transition-all duration-300 ${
            activeMedia?.media_type === 'video' ? 'aspect-video' : 'aspect-square'
          }`}>
            {activeMedia ? (
              activeMedia.media_type === 'image' ? (
                <Image
                  src={getImageUrl(activeMedia.url)}
                  alt={product.name}
                  fill
                  className="object-cover"
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
                  className={`aspect-square relative bg-gray-100 rounded-lg overflow-hidden border-2 transition-colors ${
                    index === activeMediaIndex ? 'border-blue-500' : 'border-transparent'
                  }`}
                >
                  {media.media_type === 'image' ? (
                    <Image
                      src={getImageUrl(media.url)}
                      alt={`${product.name} - изображение ${index + 1}`}
                      fill
                      className="object-cover"
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
                              className="object-cover"
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
          {/* Основная информация о товаре */}
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Название товара */}
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 mb-4">{product.name}</h1>
                </div>

                {/* Информация о товаре */}
                <div className="space-y-3">
                  {product.brand && product.brand !== 'no' && (
                    <div className="text-sm text-gray-600 relative">
                      <span className="font-medium">Бренд:</span>{" "}
                      <Link
                        href={`/brand/${encodeURIComponent(product.brand)}`}
                        className="inline-block px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md shadow-sm hover:shadow-md transition-all duration-200 text-xs font-medium"
                        onMouseEnter={() => setShowBrandTooltip(true)}
                        onMouseLeave={() => setShowBrandTooltip(false)}
                      >
                        {product.brand}
                      </Link>
                      
                      {/* Кастомная подсказка */}
                      {showBrandTooltip && (
                        <div className="absolute z-50 px-3 py-2 bg-white text-black text-xs rounded-lg shadow-lg border border-gray-200 -top-12 left-0 whitespace-nowrap">
                          Посмотрите все товары бренда "{product.brand}"
                          {/* Стрелка вниз */}
                          <div className="absolute top-full left-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-white"></div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {product.country && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Страна производитель:</span> {product.country}
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
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Цена:</span> {product.price.toLocaleString()} тг
                    </div>
                  )}
                  
                  {product.wholesale_price && product.wholesale_price > 0 && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Оптовая цена:</span> {product.wholesale_price.toLocaleString()} тг
                    </div>
                  )}
                </div>

                {/* Кнопки действий */}
                <div className="flex gap-3 pt-4">
                  <AddToCartButton
                    productId={product.id}
                    productName={product.name}
                    className="flex-1 bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-3 px-6 rounded-lg"
                  >
                    <ShoppingCart className="h-5 w-5 mr-2" />
                    Добавить в корзину
                  </AddToCartButton>
                  
                  <FavoriteButton
                    productId={product.id}
                    productName={product.name}
                    className="flex-shrink-0 border border-gray-200 rounded-lg py-3 px-3"
                    variant="ghost"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Табы с дополнительной информацией */}
          {activeTabsCount > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`grid w-full grid-cols-${Math.max(1, activeTabsCount)}`}>
                {product.description && product.description.trim() !== '' && (
                  <TabsTrigger value="description">Описание</TabsTrigger>
                )}
                {product.characteristics.length > 0 && (
                  <TabsTrigger value="characteristics">Характеристики</TabsTrigger>
                )}
                {product.documents.length > 0 && (
                  <TabsTrigger value="documents">Документы</TabsTrigger>
                )}
                {product.drivers.length > 0 && (
                  <TabsTrigger value="drivers">Драйверы</TabsTrigger>
                )}
              </TabsList>

            <TabsContent value="description" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {product.description ? (
                    <div className="prose max-w-none">
                      <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Описание товара отсутствует</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>



            <TabsContent value="characteristics" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {product.characteristics.length > 0 ? (
                    <div className="space-y-3">
                      {product.characteristics
                        .sort((a, b) => a.sort_order - b.sort_order)
                        .map((char) => (
                          <div key={char.id} className="flex justify-between py-2 border-b border-gray-100 last:border-b-0">
                            <span className="font-medium text-gray-700">{char.key}</span>
                            <span className="text-gray-600">{char.value}</span>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Характеристики товара отсутствуют</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {product.documents.length > 0 ? (
                    <div className="space-y-3">
                      {product.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-900">{doc.filename}</p>
                              <p className="text-sm text-gray-500">{doc.mime_type}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(doc.url, doc.filename)}
                            disabled={downloadingFiles.has(`${doc.url}-${doc.filename}`)}
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
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Документы отсутствуют</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="drivers" className="mt-4">
              <Card>
                <CardContent className="p-4">
                  {product.drivers.length > 0 ? (
                    <div className="space-y-3">
                      {product.drivers.map((driver) => (
                        <div key={driver.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Package className="h-5 w-5 text-gray-500" />
                            <div>
                              <p className="font-medium text-gray-900">{driver.filename}</p>
                              <p className="text-sm text-gray-500">{driver.mime_type}</p>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadFile(driver.url, driver.filename)}
                            disabled={downloadingFiles.has(`${driver.url}-${driver.filename}`)}
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
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Драйверы отсутствуют</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          ) : null}
        </div>
      </div>
    </div>
  )
}
