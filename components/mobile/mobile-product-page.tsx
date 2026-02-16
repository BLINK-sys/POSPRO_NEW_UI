"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Download, ChevronDown, ChevronUp, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getProductBySlug } from "@/app/actions/products"
import { getImageUrl } from "@/lib/image-utils"
import { formatProductPrice, getRetailPriceClass, getWholesalePriceClass, isWholesaleUser } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { API_BASE_URL } from "@/lib/api-address"

interface MobileProductPageProps {
  slug: string
}

// YouTube helpers
const isYouTubeUrl = (url: string): boolean => {
  return url.includes("youtube.com") || url.includes("youtu.be")
}

const getYouTubeEmbedUrl = (url: string): string => {
  const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
  return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : url
}

const getYouTubeThumbnail = (url: string): string | null => {
  const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
  return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null
}

export default function MobileProductPage({ slug }: MobileProductPageProps) {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null)
  const touchStartX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const data = await getProductBySlug(slug)
        setProduct(data)
      } catch (error) {
        console.error("Error loading product:", error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [slug])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
    setIsDragging(true)
    setDragOffset(0)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging) return
    const delta = e.targetTouches[0].clientX - touchStartX.current
    setDragOffset(delta)
  }, [isDragging])

  const handleTouchEnd = useCallback((mediaCount: number) => {
    if (!isDragging) return
    setIsDragging(false)
    const threshold = 50
    if (dragOffset < -threshold) {
      setCurrentSlide((p) => Math.min(p + 1, mediaCount - 1))
    } else if (dragOffset > threshold) {
      setCurrentSlide((p) => Math.max(p - 1, 0))
    }
    setDragOffset(0)
  }, [isDragging, dragOffset])

  // Деактивировать видео при смене слайда через миниатюры
  useEffect(() => {
    setActiveVideoIndex(null)
  }, [currentSlide])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-12 text-gray-500">
        Товар не найден
      </div>
    )
  }

  // Собираем все медиа
  const mediaItems: { type: string; url: string }[] = []
  if (product.image_url) {
    mediaItems.push({ type: "image", url: product.image_url })
  }
  if (product.media && Array.isArray(product.media)) {
    product.media
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      .forEach((m: any) => {
        const url = m.url || m.file_url
        if (url && url !== product.image_url) {
          mediaItems.push({ type: m.media_type || "image", url })
        }
      })
  }

  const description = product.description || ""
  const isLongDesc = description.length > 200

  const trackOffset = -(currentSlide * 100)
  const dragPercent = containerRef.current
    ? (dragOffset / containerRef.current.offsetWidth) * 100
    : 0

  return (
    <div className="pb-24">
      {/* Свайп-галерея — только изображения/превью, без iframe */}
      {mediaItems.length > 0 ? (
        <div className="relative bg-white">
          <div
            ref={containerRef}
            className="relative overflow-hidden"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={() => handleTouchEnd(mediaItems.length)}
          >
            <div
              className="flex"
              style={{
                transform: `translateX(${trackOffset + dragPercent}%)`,
                transition: isDragging ? "none" : "transform 0.35s ease-out",
              }}
            >
              {mediaItems.map((media, index) => {
                const isVideo = media.type === "video"
                const isYT = isVideo && isYouTubeUrl(media.url)
                const thumbnail = isYT ? getYouTubeThumbnail(media.url) : null
                const isPlaying = activeVideoIndex === index

                return (
                  <div key={index} className="w-full shrink-0">
                    <div className="relative aspect-square bg-white flex items-center justify-center">
                      {isVideo && isPlaying ? (
                        /* Видео активировано — показываем плеер инлайн */
                        isYT ? (
                          <iframe
                            src={getYouTubeEmbedUrl(media.url)}
                            className="w-full h-full"
                            frameBorder={0}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            src={getImageUrl(media.url)}
                            controls
                            autoPlay
                            playsInline
                            className="w-full h-full object-contain"
                          />
                        )
                      ) : isVideo ? (
                        <>
                          {/* Превью — обычная картинка, свайп работает */}
                          {thumbnail ? (
                            <Image
                              src={thumbnail}
                              alt="Video"
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                              <Play className="h-16 w-16 text-gray-300" />
                            </div>
                          )}
                          {/* Кнопка Play — активирует видео инлайн */}
                          <button
                            onClick={() => setActiveVideoIndex(index)}
                            className="absolute inset-0 z-10 flex items-center justify-center"
                          >
                            <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
                              <Play className="h-10 w-10 text-white fill-white ml-1" />
                            </div>
                          </button>
                        </>
                      ) : (
                        <Image
                          src={getImageUrl(media.url)}
                          alt={product.name}
                          fill
                          className="object-contain p-4"
                        />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Индикаторы */}
          {mediaItems.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
              {mediaItems.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentSlide ? "bg-brand-yellow w-4" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Избранное */}
          <div className="absolute top-3 right-3 z-20">
            <FavoriteButton
              productId={product.id}
              productName={product.name}
              className="w-9 h-9 bg-white/90 rounded-full shadow-md"
            />
          </div>

          {/* Миниатюры */}
          {mediaItems.length > 1 && (
            <div className="flex gap-2 px-4 py-2 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: "none" }}>
              {mediaItems.map((media, i) => {
                const isVideo = media.type === "video"
                const isYT = isVideo && isYouTubeUrl(media.url)
                const thumb = isYT ? getYouTubeThumbnail(media.url) : null

                return (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                      i === currentSlide ? "border-brand-yellow" : "border-gray-200"
                    }`}
                  >
                    {isVideo ? (
                      <div className="relative w-full h-full bg-gray-100">
                        {thumb ? (
                          <Image src={thumb} alt="Video" fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-3 w-3 text-white fill-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-full h-full">
                        <Image
                          src={getImageUrl(media.url)}
                          alt={`${product.name} ${i + 1}`}
                          fill
                          className="object-contain p-0.5"
                        />
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="aspect-square bg-gray-100 flex items-center justify-center">
          <span className="text-4xl">📦</span>
        </div>
      )}

      {/* Информация */}
      <div className="px-4 py-4 space-y-3">
        {/* Статус */}
        {product.status && (
          <Badge
            style={{ backgroundColor: product.status.background_color, color: product.status.text_color }}
          >
            {product.status.name}
          </Badge>
        )}

        {/* Название */}
        <h1 className="text-lg font-bold leading-tight">{product.name}</h1>

        {/* Бренд */}
        {product.brand_info && (
          <Link
            href={`/brand/${encodeURIComponent(product.brand_info.name)}`}
            className="text-sm text-brand-yellow font-medium"
          >
            {product.brand_info.name}
            {product.brand_info.country && (
              <span className="text-gray-500 font-normal"> · {product.brand_info.country}</span>
            )}
          </Link>
        )}

        {/* Поставщик (только для system) */}
        {user?.role === "system" && product.supplier?.name && (
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">Поставщик:</span> {product.supplier.name}
          </div>
        )}

        {/* Наличие */}
        {product.availability_status && (
          <div>
            <span
              className="inline-block text-xs px-2 py-1 rounded"
              style={{
                backgroundColor: product.availability_status.background_color,
                color: product.availability_status.text_color,
              }}
            >
              {product.availability_status.status_name}
            </span>
          </div>
        )}

        {/* Цены */}
        <div className="space-y-1">
          <div className={`text-xl font-bold ${getRetailPriceClass(wholesaleUser)}`}>
            {formatProductPrice(product.price)}
          </div>
          {wholesaleUser && (
            <div className={`text-base font-bold ${getWholesalePriceClass()}`}>
              Оптовая: {formatProductPrice(product.wholesale_price)}
            </div>
          )}
        </div>

        {/* Описание */}
        {description && (
          <div>
            <p className={`text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line ${!descExpanded && isLongDesc ? "line-clamp-4" : ""}`}>
              {description}
            </p>
            {isLongDesc && (
              <button
                onClick={() => setDescExpanded(!descExpanded)}
                className="text-sm text-brand-yellow font-medium mt-1 flex items-center gap-1"
              >
                {descExpanded ? "Свернуть" : "Читать далее"}
                {descExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
        )}

        {/* Табы */}
        <Tabs defaultValue="characteristics" className="mt-4">
          <TabsList className="w-full h-auto flex-wrap">
            {product.characteristics && product.characteristics.length > 0 && (
              <TabsTrigger value="characteristics" className="text-xs flex-1">Характеристики</TabsTrigger>
            )}
            {product.documents && product.documents.length > 0 && (
              <TabsTrigger value="documents" className="text-xs flex-1">Документы</TabsTrigger>
            )}
            {product.drivers && product.drivers.length > 0 && (
              <TabsTrigger value="drivers" className="text-xs flex-1">Драйверы</TabsTrigger>
            )}
          </TabsList>

          {product.characteristics && product.characteristics.length > 0 && (
            <TabsContent value="characteristics">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3">
                  <div className="space-y-2">
                    {product.characteristics
                      .filter((char: any) => char.key?.toLowerCase() !== "code")
                      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
                      .map((char: any, i: number) => (
                        <div key={char.id || i} className="flex justify-between text-sm border-b border-gray-100 pb-2 last:border-0">
                          <span className="text-gray-500">{char.key}</span>
                          <span className="font-medium text-right">
                            {char.value}
                            {char.unit_of_measurement && (
                              <span className="text-gray-400 text-xs ml-1">({char.unit_of_measurement})</span>
                            )}
                          </span>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {product.documents && product.documents.length > 0 && (
            <TabsContent value="documents">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 space-y-3">
                  {product.documents.map((doc: any, i: number) => (
                    <div key={doc.id || i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-16 h-16 bg-black rounded-lg shrink-0 relative overflow-hidden">
                        <Image
                          src="/ui/for_docs_driver.png"
                          alt="Document"
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.filename || "Документ"}</p>
                        {doc.file_type && <p className="text-xs text-gray-500 mt-0.5">{doc.file_type}</p>}
                        <a
                          href={getImageUrl(doc.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" className="mt-2 bg-brand-yellow hover:bg-yellow-500 text-black font-medium h-7 text-xs rounded-full px-4">
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Скачать
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {product.drivers && product.drivers.length > 0 && (
            <TabsContent value="drivers">
              <Card className="border-0 shadow-sm">
                <CardContent className="p-3 space-y-3">
                  {product.drivers.map((driver: any, i: number) => (
                    <div key={driver.id || i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-16 h-16 bg-black rounded-lg shrink-0 relative overflow-hidden">
                        <Image
                          src="/ui/for_docs_driver.png"
                          alt="Driver"
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{driver.filename || "Драйвер"}</p>
                        {driver.file_type && <p className="text-xs text-gray-500 mt-0.5">{driver.file_type}</p>}
                        <a
                          href={getImageUrl(driver.url)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button size="sm" className="mt-2 bg-brand-yellow hover:bg-yellow-500 text-black font-medium h-7 text-xs rounded-full px-4">
                            <Download className="h-3.5 w-3.5 mr-1.5" />
                            Скачать
                          </Button>
                        </a>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Sticky кнопка "В корзину" */}
      <div className="fixed bottom-16 left-0 right-0 z-40 bg-white dark:bg-gray-950 border-t border-gray-200 px-4 py-3 flex items-center gap-3">
        <div className="flex-1">
          <div className={`text-lg font-bold ${getRetailPriceClass(wholesaleUser)}`}>
            {formatProductPrice(product.price)}
          </div>
        </div>
        <AddToCartButton
          productId={product.id}
          productName={product.name}
          className="bg-brand-yellow hover:bg-yellow-500 text-black font-bold px-6 py-2.5 rounded-xl shadow-lg text-sm"
        />
      </div>

    </div>
  )
}
