"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, LayoutGrid, Loader2 } from "lucide-react"
import { getImageUrl } from "@/lib/image-utils"
import { getIcon } from "@/lib/icon-mapping"
import { formatProductPrice, getRetailPriceClass, getWholesalePriceClass, isWholesaleUser } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { ProductAvailabilityBadge } from "@/components/product-availability-badge"
import type { HomepageBlock, Banner, ProductData, CategoryData, BrandData, BenefitData, SmallBannerData } from "@/app/actions/public"

interface MobileHomePageProps {
  banners: Banner[]
  blocks: HomepageBlock[]
}

export default function MobileHomePage({ banners, blocks }: MobileHomePageProps) {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)

  return (
    <div className="bg-white dark:bg-gray-950">
      {/* Баннер */}
      {banners && banners.length > 0 && <MobileBanner banners={banners} />}

      {/* Блоки */}
      {blocks && blocks.length > 0 && blocks.map((block, index) => (
        <MobileBlock
          key={block.id}
          block={block}
          wholesaleUser={wholesaleUser}
          isLast={index === blocks.length - 1}
        />
      ))}
    </div>
  )
}

/* ========== Отдельная карточка баннера ========== */
function BannerSlide({ banner }: { banner: Banner }) {
  return banner.image ? (
    <div className="relative w-full aspect-[2/1]">
      <Image
        src={getImageUrl(banner.image)}
        alt={banner.title}
        fill
        className="object-cover"
        sizes="100vw"
      />
      <div className="absolute inset-0 bg-black/30 flex items-center justify-center p-4">
        <div className="text-center text-white">
          <h2 className="text-lg font-bold mb-1">{banner.title}</h2>
          {banner.subtitle && (
            <p className="text-sm mb-3 line-clamp-2">{banner.subtitle}</p>
          )}
          {banner.show_button && banner.button_text && (
            <Button size="sm" className="bg-brand-yellow text-black hover:bg-yellow-500" asChild>
              <Link href={banner.button_link || "#"}>{banner.button_text}</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  ) : (
    <div className="w-full aspect-[2/1] bg-gray-100 flex items-center justify-center">
      <div className="text-center p-4">
        <h2 className="text-lg font-bold mb-1">{banner.title}</h2>
        {banner.subtitle && <p className="text-sm text-gray-600">{banner.subtitle}</p>}
      </div>
    </div>
  )
}

/* ========== Мобильный баннер-карусель ========== */
function MobileBanner({ banners }: { banners: Banner[] }) {
  const [current, setCurrent] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const touchStartX = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)

  // Если 1 баннер — просто статичная карточка
  if (banners.length <= 1) {
    return (
      <section className="px-4 pt-4">
        <div className="rounded-xl overflow-hidden shadow-xl">
          {banners[0] && <BannerSlide banner={banners[0]} />}
        </div>
      </section>
    )
  }

  // Автопрокрутка (останавливается при свайпе)
  useEffect(() => {
    if (isDragging) return
    const timer = setInterval(() => {
      setCurrent((p) => (p + 1) % banners.length)
    }, 5000)
    return () => clearInterval(timer)
  }, [banners.length, current, isDragging])

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX
    setIsDragging(true)
    setDragOffset(0)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    const delta = e.targetTouches[0].clientX - touchStartX.current
    setDragOffset(delta)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return
    setIsDragging(false)
    const threshold = 50
    if (dragOffset < -threshold) {
      setCurrent((p) => (p + 1) % banners.length)
    } else if (dragOffset > threshold) {
      setCurrent((p) => (p - 1 + banners.length) % banners.length)
    }
    setDragOffset(0)
  }

  const trackOffset = -(current * 100)
  const dragPercent = containerRef.current
    ? (dragOffset / containerRef.current.offsetWidth) * 100
    : 0

  return (
    <section className="px-4 pt-4">
      <div
        ref={containerRef}
        className="relative rounded-xl overflow-hidden shadow-xl"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Горизонтальный трек — все баннеры в ряд */}
        <div
          className="flex"
          style={{
            transform: `translateX(${trackOffset + dragPercent}%)`,
            transition: isDragging ? "none" : "transform 0.35s ease-out",
          }}
        >
          {banners.map((banner) => (
            <div key={banner.id} className="w-full shrink-0">
              <BannerSlide banner={banner} />
            </div>
          ))}
        </div>

        {/* Индикаторы */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === current ? "bg-brand-yellow w-4" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

/* ========== Мобильный блок ========== */
function MobileBlock({ block, wholesaleUser, isLast }: { block: HomepageBlock; wholesaleUser: boolean; isLast: boolean }) {
  return (
    <section className="py-6">
      <div className="px-4">
        {block.show_title && (
          <h2 className="text-xl font-bold mb-4">{block.title}</h2>
        )}
        <MobileBlockContent block={block} wholesaleUser={wholesaleUser} />
      </div>
      {!isLast && <div className="mx-4 mt-6 h-px bg-gray-200" />}
    </section>
  )
}

function MobileBlockContent({ block, wholesaleUser }: { block: HomepageBlock; wholesaleUser: boolean }) {
  if (!block.items || block.items.length === 0) {
    return <div className="text-center py-4 text-gray-500 text-sm">Нет элементов</div>
  }

  switch (block.type) {
    case "product":
    case "products":
      return <MobileProductsBlock items={block.items as ProductData[]} wholesaleUser={wholesaleUser} />
    case "category":
    case "categories":
      return <MobileCategoriesBlock items={block.items as CategoryData[]} />
    case "brand":
    case "brands":
      return <MobileBrandsBlock items={block.items as BrandData[]} />
    case "benefit":
    case "benefits":
      return <MobileBenefitsBlock items={block.items as BenefitData[]} />
    case "small_banner":
    case "small_banners":
    case "info_cards":
      return <MobileSmallBannersBlock items={block.items as SmallBannerData[]} />
    default:
      return null
  }
}

/* ---- Товары: до 10 на строку, строки независимые ---- */
function MobileProductsBlock({ items, wholesaleUser }: { items: ProductData[]; wholesaleUser: boolean }) {
  const MAX_PER_ROW = 10

  if (items.length <= MAX_PER_ROW) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        {items.map((product) => (
          <ProductScrollCard key={product.id} product={product} wholesaleUser={wholesaleUser} />
        ))}
      </div>
    )
  }

  // Split items into rows of max 10
  const rows: ProductData[][] = []
  for (let i = 0; i < items.length; i += MAX_PER_ROW) {
    rows.push(items.slice(i, i + MAX_PER_ROW))
  }

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => (
        <div key={idx} className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
          {row.map((product) => (
            <ProductScrollCard key={product.id} product={product} wholesaleUser={wholesaleUser} />
          ))}
        </div>
      ))}
    </div>
  )
}

function ProductScrollCard({ product, wholesaleUser }: { product: ProductData; wholesaleUser: boolean }) {
  return (
    <div className="shrink-0 w-[160px]">
      <Card className="overflow-hidden border border-gray-200 shadow-[3px_3px_8px_rgba(0,0,0,0.1)] h-full flex flex-col">
        <CardContent className="p-2 flex flex-col flex-1">
          <Link href={`/product/${product.slug}`}>
            <div className="relative aspect-square bg-white rounded-lg overflow-hidden mb-2">
              {product.image_url ? (
                <Image
                  src={getImageUrl(product.image_url)}
                  alt={product.name}
                  fill
                  className="object-contain p-1"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-2xl">📦</div>
              )}
              {product.status && (
                <Badge
                  className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5"
                  style={{ backgroundColor: product.status.background_color, color: product.status.text_color }}
                >
                  {product.status.name}
                </Badge>
              )}
              <div className="absolute top-1 right-1 z-10">
                <FavoriteButton
                  productId={product.id}
                  productName={product.name}
                  className="w-7 h-7 bg-white/90 rounded-full shadow-sm"
                  size="sm"
                />
              </div>
            </div>
          </Link>

          {/* Информация о товаре — как на десктопе */}
          <div className="space-y-0.5 flex-1">
            <p className="text-[11px] text-gray-700 font-medium line-clamp-2 leading-tight overflow-hidden">
              {product.name}
            </p>
            <p className={`text-[11px] font-bold ${getRetailPriceClass(product.price, wholesaleUser)}`}>
              <span className="font-medium">Цена:</span> {formatProductPrice(product.price)}
            </p>
            {wholesaleUser && product.wholesale_price && (
              <p className={`text-[11px] font-bold ${getWholesalePriceClass()}`}>
                <span className="font-medium">Оптовая цена:</span> {formatProductPrice(product.wholesale_price)}
              </p>
            )}
            <div className="text-[11px] text-gray-600">
              <span className="font-medium">Наличие:</span>{" "}
              {product.availability_status ? (
                <span
                  className="inline-block px-1.5 py-0.5 rounded text-[10px]"
                  style={{
                    backgroundColor: product.availability_status.background_color,
                    color: product.availability_status.text_color,
                  }}
                >
                  {product.availability_status.status_name}
                </span>
              ) : product.quantity !== undefined ? (
                <span>{product.quantity} шт.</span>
              ) : null}
            </div>
          </div>

          <div className="mt-1.5">
            <AddToCartButton
              productId={product.id}
              productName={product.name}
              className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-1 rounded-lg text-[10px] h-7"
              size="sm"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* ---- Категории: 1 строка если <=8, 2 строки если >8 ---- */
function MobileCategoriesBlock({ items }: { items: CategoryData[] }) {
  const useTwoRows = items.length > 8

  if (useTwoRows) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            {items.slice(0, Math.ceil(items.length / 2)).map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
          <div className="flex gap-3">
            {items.slice(Math.ceil(items.length / 2)).map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
      {items.map((category) => (
        <CategoryCard key={category.id} category={category} />
      ))}
    </div>
  )
}

function CategoryCard({ category }: { category: CategoryData }) {
  return (
    <Link href={`/category/${category.slug}`} className="shrink-0 w-[130px]">
      <Card className="overflow-hidden border border-gray-200 shadow-[3px_3px_8px_rgba(0,0,0,0.1)] h-full flex flex-col">
        <CardContent className="p-0 flex flex-col flex-1">
          <div className="relative h-24 bg-white flex items-center justify-center overflow-hidden">
            {category.image_url ? (
              <Image
                src={getImageUrl(category.image_url)}
                alt={category.name}
                fill
                className="object-contain p-2"
              />
            ) : (
              <span className="text-2xl">📁</span>
            )}
          </div>
          <div className="bg-brand-yellow px-2 py-2 mt-auto">
            <p className="text-xs font-bold text-gray-900 line-clamp-2 leading-tight text-center">
              {category.name}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

/* ---- Сетка брендов ---- */
function MobileBrandsBlock({ items }: { items: BrandData[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 p-1">
      {/* Постоянная карточка "Бренды" */}
      <Link href="/brands">
        <Card className="overflow-hidden border border-gray-200 shadow-[3px_3px_8px_rgba(0,0,0,0.1)] rounded-xl aspect-square">
          <CardContent className="p-0 h-full relative">
            <div className="flex flex-col items-center justify-center h-full bg-brand-yellow">
              <LayoutGrid className="h-8 w-8 text-black" />
              <span className="text-sm font-bold text-black mt-1">Бренды</span>
            </div>
          </CardContent>
        </Card>
      </Link>
      {items.map((brand) => (
        <Link key={brand.id} href={`/brand/${encodeURIComponent(brand.name)}`}>
          <Card className="overflow-hidden border border-gray-200 shadow-[3px_3px_8px_rgba(0,0,0,0.1)] rounded-xl aspect-square">
            <CardContent className="p-0 h-full relative">
              {brand.image_url ? (
                <Image
                  src={getImageUrl(brand.image_url)}
                  alt={brand.name}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex items-center justify-center h-full bg-gray-50">
                  <span className="text-xs font-semibold text-gray-500 text-center px-1">{brand.name}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

/* ---- Горизонтальный скролл преимуществ ---- */
function MobileBenefitsBlock({ items }: { items: BenefitData[] }) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
      {items.map((benefit) => (
        <Card key={benefit.id} className="shrink-0 w-[200px] border border-gray-200 shadow-[3px_3px_8px_rgba(0,0,0,0.1)]">
          <CardContent className="p-4">
            <div className="w-10 h-10 bg-brand-yellow rounded-full flex items-center justify-center mb-3">
              {getIcon(benefit.icon)}
            </div>
            <h3 className="font-bold text-sm mb-1">{benefit.title}</h3>
            <p className="text-xs text-gray-600 line-clamp-3">{benefit.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ---- Инфо-карточки (small banners) ---- */
function MobileSmallBannersBlock({ items }: { items: SmallBannerData[] }) {
  return (
    <div className="space-y-3">
      {items.map((banner) => (
        <Card
          key={banner.id}
          className="overflow-hidden border border-gray-200 shadow-[3px_3px_8px_rgba(0,0,0,0.1)] rounded-xl"
          style={{
            backgroundColor: banner.background_image_url ? "transparent" : banner.card_bg_color,
            backgroundImage: banner.background_image_url ? `url(${getImageUrl(banner.background_image_url)})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {banner.image_url && (
                <div className="w-20 h-20 relative shrink-0">
                  <Image src={getImageUrl(banner.image_url)} alt={banner.title} fill className="object-contain" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3
                  className="font-semibold text-sm mb-1"
                  style={{ color: banner.title_text_color || "#000" }}
                >
                  {banner.title}
                </h3>
                <p
                  className="text-xs line-clamp-2"
                  style={{ color: banner.description_text_color || "#666" }}
                >
                  {banner.description}
                </p>
                {banner.show_button && banner.button_text && (
                  <Button
                    size="sm"
                    className="mt-2 text-xs h-7"
                    style={{ backgroundColor: banner.button_bg_color, color: banner.button_text_color }}
                    asChild
                  >
                    <a href={banner.button_link || "#"} target={banner.open_in_new_tab ? "_blank" : "_self"}>
                      {banner.button_text}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
