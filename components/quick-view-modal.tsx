"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { X, ExternalLink } from "lucide-react"
import { getProductBySlug, Product } from "@/app/actions/products"
import { getProductAvailabilityStatus, ProductAvailabilityStatus } from "@/app/actions/public"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { ProductAvailabilityBadge } from "@/components/product-availability-badge"
import { API_BASE_URL } from "@/lib/api-address"
import { formatProductPrice, getRetailPriceClass, getWholesalePriceClass, isWholesaleUser } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import ReactDOM from "react-dom"

interface QuickViewModalProps {
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function QuickViewModal({ slug, open, onOpenChange }: QuickViewModalProps) {
  const { user } = useAuth()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [availabilityStatus, setAvailabilityStatus] = useState<ProductAvailabilityStatus | null>(null)

  const wholesaleUser = isWholesaleUser(user)
  const isSystemUser = user?.role === "admin" || user?.role === "system"

  const getImageUrl = (url: string | null | undefined): string => {
    if (!url || typeof url !== 'string' || url.trim() === "") return "/placeholder.svg"
    if (url.startsWith("http://") || url.startsWith("https://")) return url
    if (url.startsWith("/uploads/")) return `${API_BASE_URL}${url}`
    return `${API_BASE_URL}${url.startsWith("/") ? url : `/${url}`}`
  }

  useEffect(() => {
    if (open && slug) {
      setLoading(true)
      getProductBySlug(slug)
        .then(async (data) => {
          const status = await getProductAvailabilityStatus(data.quantity, data.supplier_id)
          setAvailabilityStatus(status)
          setProduct(data)

          // Трекинг быстрого просмотра (кроме системных пользователей)
          if (user?.role !== 'admin' && user?.role !== 'system') {
            fetch(`${API_BASE_URL}/api/track-product-view`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                product_id: data.id,
                product_name: data.name,
                product_slug: data.slug,
                user_agent: navigator.userAgent,
                view_type: 'quick'
              })
            }).catch(() => {})
          }
        })
        .catch(() => setProduct(null))
        .finally(() => setLoading(false))
    }
  }, [open, slug])

  // Берём только первое изображение
  const firstImage = product?.media?.filter(m => m.media_type === 'image' && m.url)?.sort((a, b) => a.order - b.order)?.[0]
  const imageUrl = firstImage?.url || product?.image || null

  const characteristics = product?.characteristics?.filter(c => c.key.toLowerCase() !== 'code')?.sort((a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id)) || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[900px] w-[90vw] max-h-[85vh] overflow-hidden p-0 gap-0"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.stopPropagation()}
      >
        {/* Кнопка закрытия */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpenChange(false) }}
          className="absolute top-3 right-3 z-50 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : !product ? (
          <div className="flex items-center justify-center h-[400px] text-gray-500">
            Товар не найден
          </div>
        ) : (
          <div className="flex flex-col max-h-[85vh]">
            {/* Основной контент */}
            <div className="flex flex-1 overflow-hidden">
              {/* Левая колонка — изображение, центрировано по вертикали */}
              <div className="w-[45%] p-5 flex flex-col items-center justify-center">
                <div className="relative w-full aspect-square bg-gray-50 rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                  {imageUrl ? (
                    <Image
                      src={getImageUrl(imageUrl)}
                      alt={product.name}
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400 text-4xl">📦</div>
                  )}

                  {/* Статус товара */}
                  {product.status && typeof product.status === 'object' && (
                    <div className="absolute top-2 left-2 z-10">
                      <Badge
                        className="text-xs px-2 py-1 shadow-md"
                        style={{
                          backgroundColor: (product.status as any).background_color,
                          color: (product.status as any).text_color
                        }}
                      >
                        {(product.status as any).name}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Кнопка подробнее */}
                <Link
                  href={`/product/${product.slug}`}
                  onClick={(e) => { e.stopPropagation(); onOpenChange(false) }}
                  className="mt-4 inline-flex items-center gap-1.5 px-5 py-2 bg-yellow-400 hover:bg-yellow-500 text-black text-sm font-medium rounded-md shadow-md hover:shadow-lg transition-all"
                >
                  Подробнее о товаре <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Правая колонка — информация */}
              <div className="w-[55%] p-5 pl-0 overflow-y-auto max-h-[85vh]">
                {/* Название */}
                <h2 className="text-lg font-semibold mb-1 pr-8">{product.name}</h2>

                {/* Артикул */}
                {product.article && (
                  <p className="text-sm text-gray-500 mb-3">Артикул: {product.article}</p>
                )}

                {/* Бренд */}
                {product.brand_info && (
                  <div className="text-sm text-gray-600 mb-3">
                    <span className="font-medium">Бренд: </span>
                    <Link
                      href={`/brand/${encodeURIComponent(product.brand_info.name)}`}
                      onClick={(e) => { e.stopPropagation(); onOpenChange(false) }}
                      className="inline-flex items-center px-3 py-1 bg-gray-100 hover:bg-yellow-400 text-gray-700 hover:text-black text-sm rounded-lg shadow-sm hover:shadow-md transition-all"
                    >
                      {product.brand_info.name}
                      {product.brand_info.country && ` · ${product.brand_info.country}`}
                    </Link>
                  </div>
                )}

                <Separator className="mb-3" />

                {/* Цена */}
                <div className="space-y-1 mb-3">
                  <div className={`text-xl font-bold ${getRetailPriceClass(wholesaleUser)}`}>
                    {formatProductPrice(product.price)}
                  </div>
                  {wholesaleUser && (
                    <div className={`text-lg font-bold ${getWholesalePriceClass()}`}>
                      Оптовая: {formatProductPrice(product.wholesale_price)}
                    </div>
                  )}
                </div>

                {/* Наличие */}
                <div className="mb-3">
                  {availabilityStatus ? (
                    <ProductAvailabilityBadge availabilityStatus={availabilityStatus} quantity={product.quantity} />
                  ) : (
                    <span className="text-sm text-gray-600">В наличии: {product.quantity} шт.</span>
                  )}
                </div>

                {/* Поставщик (только для админов) */}
                {isSystemUser && (product.supplier?.name || (product as any).supplier_name) && (
                  <p className="text-sm text-gray-500 mb-3">
                    Поставщик: {product.supplier?.name || (product as any).supplier_name}
                  </p>
                )}

                <Separator className="mb-3" />

                {/* Кнопки */}
                <div className="flex gap-2 mb-4">
                  <AddToCartButton
                    productId={product.id}
                    productName={product.name}
                    productSlug={product.slug}
                    productPrice={product.price}
                    productImageUrl={product.image}
                    productArticle={product.article}
                    showText
                    className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-black border-0 shadow-md hover:shadow-lg"
                  />
                  <FavoriteButton
                    productId={product.id}
                    productName={product.name}
                    className="w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-100 shadow-md hover:shadow-lg"
                    size="sm"
                  />
                </div>

                {/* Характеристики */}
                {characteristics.length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-2">Характеристики</h3>
                    <div className="space-y-1">
                      {characteristics.map((char) => (
                        <div key={char.id} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                          <span className="text-gray-600">{char.key}</span>
                          <span className="font-medium text-right ml-4">
                            {char.value}
                            {(char as any).unit_of_measurement && ` ${(char as any).unit_of_measurement}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Кнопка быстрого просмотра для карточек товаров
interface QuickViewButtonProps {
  slug: string
  className?: string
}

export function QuickViewButton({ slug, className = "" }: QuickViewButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        className={`text-xs bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-full backdrop-blur-sm transition-all ${className}`}
      >
        Быстрый просмотр
      </button>
      {open && ReactDOM.createPortal(
        <QuickViewModal slug={slug} open={open} onOpenChange={setOpen} />,
        document.body
      )}
    </>
  )
}
