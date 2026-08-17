"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { X, ExternalLink, Search, ListChecks, ChevronRight, ChevronLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { getProductBySlug, Product } from "@/app/actions/products"
import { getSuppliersText, getWinningWarehouseSuffix } from "@/lib/product-helpers"
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
  // Панель характеристик — выдвижная справа. По дефолту скрыта, чтобы
  // модалка была компактной; клик по кнопке «Характеристики» расширяет.
  const [charsOpen, setCharsOpen] = useState(false)
  // При открытии модалки сбрасываем состояние панели
  useEffect(() => { if (!open) setCharsOpen(false) }, [open])

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
        // Ширина зависит от того, открыта ли панель характеристик.
        // Плавный transition — модалка «расширяется вбок» при клике по
        // кнопке «Характеристики», а не выпрыгивает.
        // Ширина: закрыто = компакт 460px (=420px колонка), открыто = до
        // 95vw (панель занимает оставшееся). Колонка внутри — фикс,
        // поэтому не «прыгает» при закрытии панели.
        // Высота фиксирована через min-h — модалка не меняет размер при
        // toggle панели.
        style={{ maxWidth: charsOpen ? "min(95vw, 1100px)" : "420px" }}
        className={cn(
          "w-[95vw] h-[85vh] max-h-[85vh] overflow-hidden p-0 gap-0",
          "transition-[max-width] duration-300 ease-out",
          // Убираем встроенную кнопку закрытия shadcn Dialog (direct-child
          // absolute-button) — закрытие через клик-outside / Escape.
          "[&>button.absolute]:hidden",
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
          </div>
        ) : !product ? (
          <div className="flex items-center justify-center h-[400px] text-gray-500">
            Товар не найден
          </div>
        ) : (
          // Явная высота 85vh — grid родителя shadcn DialogContent не
          // растягивает child до full-height (grid-auto-rows: min-content),
          // поэтому h-full не работает; задаём напрямую, чтобы колонка
          // получила ограничение и overflow-y-auto заработал.
          <div className="flex w-full h-[85vh]">
            {/* ── Основная колонка ВСЕГДА 420px фикс. Модалка сама
                расширяется/сужается за счёт панели — колонка не меняет
                ширину, поэтому картинка не «прыгает» при закрытии панели.
                Scrollbar невидимый — иначе резерв полосы даёт асимметрию. */}
            <div
              className="w-[420px] shrink-0 p-5 overflow-y-auto h-full [&::-webkit-scrollbar]:hidden"
              style={{ scrollbarWidth: "none" }}
            >
              {/* Изображение (квадрат) — по центру колонки */}
              <div className="relative w-full aspect-square bg-gray-50 rounded-xl overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.15)] mb-4 mx-auto">
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
                {product.status && typeof product.status === "object" && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge
                      className="text-xs px-2 py-1 shadow-md"
                      style={{
                        backgroundColor: (product.status as any).background_color,
                        color: (product.status as any).text_color,
                      }}
                    >
                      {(product.status as any).name}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Название */}
              <h2 className="text-base font-semibold mb-2 pr-8">{product.name}</h2>

              {/* Бренд */}
              {product.brand_info && (
                <div className="text-sm text-gray-600 mb-3">
                  <span className="font-medium">Бренд: </span>
                  <Link
                    href={`/brand/${encodeURIComponent(product.brand_info.name)}`}
                    onClick={(e) => { e.stopPropagation(); onOpenChange(false) }}
                    className="inline-flex items-center px-2.5 py-0.5 bg-gray-100 hover:bg-yellow-400 text-gray-700 hover:text-black text-xs rounded-lg shadow-sm transition-all"
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
                  {formatProductPrice(product.price)}{getWinningWarehouseSuffix(product as any, isSystemUser)}
                </div>
                {wholesaleUser && (
                  <div className={`text-base font-bold ${getWholesalePriceClass()}`}>
                    Оптовая: {formatProductPrice(product.wholesale_price)}
                  </div>
                )}
              </div>

              {/* Наличие */}
              <div className="mb-2 text-sm">
                {availabilityStatus ? (
                  <ProductAvailabilityBadge availabilityStatus={availabilityStatus} quantity={product.quantity} />
                ) : (
                  <span className="text-gray-600">В наличии: {product.quantity} шт.</span>
                )}
              </div>

              {/* Поставщик (только для админов) */}
              {isSystemUser && (() => {
                const txt = getSuppliersText(product as any)
                return txt ? (
                  <p className="text-xs text-gray-500 mb-3">Поставщик: {txt}</p>
                ) : null
              })()}

              {/* Кнопка «Характеристики» — сразу после поставщика.
                  Тогл выдвигает/скрывает панель справа. */}
              {characteristics.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCharsOpen(o => !o)}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors mb-3",
                    charsOpen
                      ? "bg-brand-yellow border-brand-yellow text-black"
                      : "bg-white border-gray-200 hover:bg-yellow-50 hover:border-yellow-200 text-gray-800",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Характеристики
                    <span className="text-[11px] text-gray-500 font-normal">({characteristics.length})</span>
                  </span>
                  {charsOpen ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4 rotate-180" />}
                </button>
              )}

              <Separator className="my-3" />

              {/* Кнопка «Подробнее» + быстрые действия */}
              <div className="flex flex-col gap-2">
                <Link
                  href={`/product/${product.slug}`}
                  onClick={(e) => { e.stopPropagation(); onOpenChange(false) }}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2 bg-brand-yellow hover:bg-yellow-500 text-black text-sm font-medium rounded-md shadow-md hover:shadow-lg transition-all"
                >
                  Подробнее о товаре <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <div className="flex gap-2">
                  <AddToCartButton
                    productId={product.id}
                    productName={product.name}
                    productSlug={product.slug}
                    productPrice={product.price}
                    productImageUrl={product.image}
                    productArticle={product.article}
                    showText
                    className="flex-1 bg-white hover:bg-gray-50 text-black border border-gray-300 shadow-sm hover:shadow-md"
                  />
                  <FavoriteButton
                    productId={product.id}
                    productName={product.name}
                    className="w-10 h-10 rounded-full border border-gray-300 hover:bg-gray-100 shadow-sm hover:shadow-md"
                    size="sm"
                  />
                </div>
              </div>
            </div>

            {/* ── Панель характеристик — выдвигается вправо.
                Анимация через max-width (width:auto не анимируется в CSS).
                Реальная ширина внутри — w-max по контенту, с min/max для
                читаемости. */}
            {/* Панель характеристик: занимает всё оставшееся пространство
                модалки (flex-1). При закрытии сжимается через max-width. */}
            {characteristics.length > 0 && (
              <div
                className={cn(
                  "overflow-hidden transition-[max-width] duration-300 ease-out bg-white",
                  charsOpen
                    ? "flex-1 max-w-[680px] border-l border-gray-100"
                    : "flex-none max-w-0",
                )}
              >
                <div className="w-full h-full flex flex-col">
                  <div className="px-5 py-4 border-b border-gray-100 shrink-0">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-gray-500" />
                      Характеристики
                    </h3>
                  </div>
                  <div className="p-5 overflow-y-auto flex-1">
                    <div className="space-y-1">
                      {characteristics.map((char) => (
                        <div key={char.id} className="flex justify-between items-baseline text-sm py-1.5 border-b border-gray-100 last:border-0 gap-6">
                          <span className="text-gray-600 shrink-0">{char.key}</span>
                          <span className="font-medium text-right">
                            {char.value}
                            {(char as any).unit_of_measurement && ` ${(char as any).unit_of_measurement}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
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
  /** true → компактная кнопка-лупа (для маленьких карточек в blocks/grid) */
  iconOnly?: boolean
}

export function QuickViewButton({ slug, className = "", iconOnly = false }: QuickViewButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(true)
        }}
        title="Быстрый просмотр"
        aria-label="Быстрый просмотр"
        className={
          iconOnly
            ? `w-7 h-7 inline-flex items-center justify-center bg-brand-yellow hover:bg-yellow-500 text-black rounded-full shadow-md hover:shadow-lg transition-all ${className}`
            : `text-xs bg-black/50 hover:bg-black/70 text-white px-3 py-1.5 rounded-full backdrop-blur-sm transition-all ${className}`
        }
      >
        {iconOnly ? <Search className="h-3.5 w-3.5" /> : "Быстрый просмотр"}
      </button>
      {open && ReactDOM.createPortal(
        <QuickViewModal slug={slug} open={open} onOpenChange={setOpen} />,
        document.body
      )}
    </>
  )
}
