"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Download, ChevronDown, ChevronUp } from "lucide-react"
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
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel"

interface MobileProductPageProps {
  slug: string
}

// YouTube helpers
const isYouTubeUrl = (url: string): boolean => {
  return url.includes("youtube.com") || url.includes("youtu.be")
}

const getYouTubeEmbedUrl = (url: string): string => {
  const videoId = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1]
  return videoId ? `https://www.youtube.com/embed/${videoId}` : url
}

export default function MobileProductPage({ slug }: MobileProductPageProps) {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)

  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [descExpanded, setDescExpanded] = useState(false)
  const [currentSlide, setCurrentSlide] = useState(0)

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

  return (
    <div className="pb-24">
      {/* Свайп-галерея */}
      {mediaItems.length > 0 ? (
        <div className="relative bg-white">
          <Carousel
            opts={{ loop: true }}
            className="w-full"
            setApi={(api) => {
              api?.on("select", () => setCurrentSlide(api.selectedScrollSnap()))
            }}
          >
            <CarouselContent>
              {mediaItems.map((media, index) => (
                <CarouselItem key={index}>
                  <div className="relative aspect-square bg-white flex items-center justify-center">
                    {media.type === "video" && isYouTubeUrl(media.url) ? (
                      <iframe
                        src={getYouTubeEmbedUrl(media.url)}
                        className="w-full h-full"
                        frameBorder={0}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : media.type === "video" ? (
                      <video
                        src={getImageUrl(media.url)}
                        controls
                        playsInline
                        className="w-full h-full object-contain p-4"
                      />
                    ) : (
                      <Image
                        src={getImageUrl(media.url)}
                        alt={product.name}
                        fill
                        className="object-contain p-4"
                      />
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          {/* Индикаторы */}
          {mediaItems.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {mediaItems.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full transition-all ${
                    i === currentSlide ? "bg-brand-yellow w-4" : "bg-gray-300"
                  }`}
                />
              ))}
            </div>
          )}
          {/* Избранное */}
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton
              productId={product.id}
              productName={product.name}
              className="w-9 h-9 bg-white/90 rounded-full shadow-md"
            />
          </div>
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
          <div className={`text-xl font-bold ${getRetailPriceClass(product.price, wholesaleUser)}`}>
            {formatProductPrice(product.price)}
          </div>
          {wholesaleUser && product.wholesale_price && (
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
                    <div key={doc.id || i} className="flex items-stretch gap-3 p-2 bg-gray-50 rounded-lg min-h-[80px]">
                      <div className="aspect-square self-center bg-black rounded-lg shrink-0 relative overflow-hidden" style={{ height: "90%" }}>
                        <Image
                          src="/ui/for_docs_driver.png"
                          alt="Document"
                          fill
                          className="object-contain p-3"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
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
                    <div key={driver.id || i} className="flex items-stretch gap-3 p-2 bg-gray-50 rounded-lg min-h-[80px]">
                      <div className="aspect-square self-center bg-black rounded-lg shrink-0 relative overflow-hidden" style={{ height: "90%" }}>
                        <Image
                          src="/ui/for_docs_driver.png"
                          alt="Driver"
                          fill
                          className="object-contain p-3"
                        />
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
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
          <div className={`text-lg font-bold ${getRetailPriceClass(product.price, wholesaleUser)}`}>
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
