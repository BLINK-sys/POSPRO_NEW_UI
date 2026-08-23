"use client"

import { useState, useEffect, useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ExternalLink, Search, ListChecks } from "lucide-react"
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
  // Замороженная высота модалки при первом открытии характеристик —
  // чтобы правая панель растягивалась ТОЛЬКО до текущей высоты,
  // а не диктовала её через объём списка. При закрытии панели — сбрасываем
  // в null (высота обратно auto-по-контенту).
  const [lockedHeight, setLockedHeight] = useState<number | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  // При открытии/закрытии модалки полностью сбрасываем состояние.
  useEffect(() => {
    if (!open) {
      setCharsOpen(false)
      setLockedHeight(null)
    }
  }, [open])

  // Тогл характеристик: перед показом панели ФИКСИРУЕМ текущую высоту
  // корневого элемента модалки (по контенту левой зоны), чтобы панель
  // справа заняла ровно её и включила свой overflow-y-auto. При закрытии
  // высота снова становится auto.
  const toggleChars = () => {
    if (!charsOpen) {
      const el = contentRef.current
      if (el) setLockedHeight(el.offsetHeight)
      setCharsOpen(true)
    } else {
      setCharsOpen(false)
      setLockedHeight(null)
    }
  }

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
        ref={contentRef}
        // При открытых характеристиках модалка расширяется вбок —
        // основная зона 640px, панель характеристик — до 520px справа.
        // Высота: при открытии панели ЗАМОРАЖИВАЕМ текущую высоту
        // (lockedHeight), чтобы список характеристик не диктовал размер
        // модалки. При закрытии — снова auto по контенту.
        style={{
          maxWidth: charsOpen ? "min(96vw, 1180px)" : "min(96vw, 680px)",
          ...(charsOpen && lockedHeight ? { height: lockedHeight } : {}),
        }}
        className={cn(
          "w-[96vw] max-h-[85vh] overflow-hidden p-0 gap-0",
          "transition-[max-width] duration-300 ease-out",
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
          <div
            className="flex max-h-[85vh] min-h-0 h-full"
            style={{ height: charsOpen && lockedHeight ? lockedHeight : undefined }}
          >
            {/* ── Основная зона: 2 колонки (image/info) + footer с 2 кнопками.
                Фикс 640px чтобы не «прыгала» при открытии/закрытии панели
                справа. Высота — по контенту (не растягиваем). */}
            <div className="w-[640px] max-w-full shrink-0 flex flex-col min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-5">
              <div className="grid gap-5 md:grid-cols-2">
                {/* ── Колонка 1: изображение. На мобильном — aspect-[4/3].
                    На md+ — h-full (тянется до высоты правой колонки —
                    grid по-умолчанию stretch) с min-h чтобы никогда не
                    была меньше базового размера ~4/3 при ширине колонки. */}
                <div className="relative w-full aspect-[4/3] md:aspect-auto md:h-full md:min-h-[220px] bg-background rounded-xl overflow-hidden transition-shadow hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
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

                {/* ── Колонка 2: вся информация ────────────────────── */}
                <div className="flex flex-col gap-3">
                  <h2 className="text-lg font-semibold leading-tight pr-8">{product.name}</h2>

                  {product.brand_info && (
                    <div className="text-sm text-gray-600">
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

                  <Separator />

                  <div className="space-y-1">
                    <div className={`text-2xl font-bold ${getRetailPriceClass(wholesaleUser)}`}>
                      {formatProductPrice(product.price)}{getWinningWarehouseSuffix(product as any, isSystemUser)}
                    </div>
                    {wholesaleUser && (
                      <div className={`text-base font-bold ${getWholesalePriceClass()}`}>
                        Оптовая: {formatProductPrice(product.wholesale_price)}
                      </div>
                    )}
                  </div>

                  <div className="text-sm">
                    {availabilityStatus ? (
                      <ProductAvailabilityBadge availabilityStatus={availabilityStatus} quantity={product.quantity} />
                    ) : (
                      <span className="text-gray-600">В наличии: {product.quantity} шт.</span>
                    )}
                  </div>

                  {isSystemUser && (() => {
                    const txt = getSuppliersText(product as any)
                    return txt ? (
                      <p className="text-xs text-gray-500">Поставщик: {txt}</p>
                    ) : null
                  })()}

                  {/* Быстрые действия — «В корзину» + избранное. Оставляем
                      в правой колонке чтобы footer держал только 2 кнопки
                      «Характеристики / Подробнее», как просил юзер. */}
                  <div className="flex gap-2 mt-auto pt-2">
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

            </div>

            {/* ── Footer: 2 кнопки full-width под колонками ───────── */}
            <div className="border-t border-gray-100 p-4 flex flex-col sm:flex-row gap-2 shrink-0">
              {characteristics.length > 0 ? (
                <button
                  type="button"
                  onClick={toggleChars}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border text-sm font-medium transition-colors",
                    charsOpen
                      ? "bg-brand-yellow border-brand-yellow text-black"
                      : "bg-white border-gray-200 hover:bg-yellow-50 hover:border-yellow-200 text-gray-800",
                  )}
                >
                  <ListChecks className="h-4 w-4" />
                  Характеристики
                  <span className="text-[11px] text-gray-500 font-normal">({characteristics.length})</span>
                </button>
              ) : (
                <div className="flex-1" />
              )}
              <a
                href={`/product/${product.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-brand-yellow hover:bg-yellow-500 text-black text-sm font-medium rounded-md shadow-sm hover:shadow-md transition-all"
              >
                Подробнее о товаре <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            </div>

            {/* ── Панель характеристик — рендерим ТОЛЬКО когда открыта.
                Иначе её внутренний контент (min-height по 15+ строкам)
                через align-items:stretch раздувал бы всю строку flex,
                и левая компактная зона тянулась бы за ним → пустое место
                под правой колонкой. */}
            {characteristics.length > 0 && charsOpen && (
              <div className="flex-1 max-w-[520px] min-h-0 border-l border-gray-100 bg-white overflow-hidden">
                <div className="w-full h-full flex flex-col min-h-0">
                  <div className="px-5 py-4 border-b border-gray-100 shrink-0">
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-gray-500" />
                      Характеристики
                      <span className="text-[11px] text-gray-500 font-normal">({characteristics.length})</span>
                    </h3>
                  </div>
                  <div className="p-5 overflow-y-auto flex-1 min-h-0">
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
