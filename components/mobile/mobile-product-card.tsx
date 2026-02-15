"use client"

import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { getImageUrl } from "@/lib/image-utils"
import { formatProductPrice, getRetailPriceClass, getWholesalePriceClass } from "@/lib/utils"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"

interface MobileProductCardProps {
  product: {
    id: number
    name: string
    slug: string
    price: number
    wholesale_price?: number | null
    image_url?: string
    brand_info?: { name: string; country?: string }
    status?: { name: string; background_color: string; text_color: string }
    availability_status?: { status_name: string; background_color: string; text_color: string } | null
    quantity?: number
  }
  wholesaleUser?: boolean
  showFavorite?: boolean
  onFavoriteToggle?: (productId: number, isNowFavorite: boolean) => void
}

export default function MobileProductCard({ product, wholesaleUser = false, showFavorite = true, onFavoriteToggle }: MobileProductCardProps) {
  return (
    <Link href={`/product/${product.slug}`}>
      <Card className="overflow-hidden border border-gray-200 shadow-[3px_3px_8px_rgba(0,0,0,0.1)] h-full">
        <CardContent className="p-2">
          {/* Изображение */}
          <div className="relative aspect-square bg-white rounded-lg overflow-hidden mb-2">
            {product.image_url ? (
              <Image
                src={getImageUrl(product.image_url)}
                alt={product.name}
                fill
                className="object-contain p-1"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-2xl text-gray-400">📦</div>
            )}

            {/* Статус товара — верхний левый угол */}
            {product.status && (
              <div className="absolute top-1 left-1 z-10">
                <Badge
                  className="text-[10px] px-1.5 py-0.5 shadow-sm"
                  style={{ backgroundColor: product.status.background_color, color: product.status.text_color }}
                >
                  {product.status.name}
                </Badge>
              </div>
            )}

            {/* Избранное — верхний правый угол */}
            {showFavorite && (
              <div className="absolute top-1 right-1 z-10">
                <FavoriteButton
                  productId={product.id}
                  productName={product.name}
                  className="w-7 h-7 bg-white/90 rounded-full shadow-sm"
                  size="sm"
                  onToggleSuccess={onFavoriteToggle ? (isNowFavorite) => onFavoriteToggle(product.id, isNowFavorite) : undefined}
                />
              </div>
            )}
          </div>

          {/* Информация о товаре */}
          <div className="space-y-1">
            {/* Название */}
            <p className="text-[11px] text-gray-700 font-medium line-clamp-2 leading-tight overflow-hidden">
              {product.name}
            </p>

            {/* Цена */}
            <p className={`text-[11px] font-bold ${getRetailPriceClass(product.price, wholesaleUser)}`}>
              <span className="font-medium">Цена:</span> {formatProductPrice(product.price)}
            </p>

            {/* Оптовая цена */}
            {wholesaleUser && product.wholesale_price && (
              <p className={`text-[11px] font-bold ${getWholesalePriceClass()}`}>
                <span className="font-medium">Оптовая цена:</span> {formatProductPrice(product.wholesale_price)}
              </p>
            )}

            {/* Наличие */}
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

            {/* Кнопка В корзину */}
            <div className="pt-1" onClick={(e) => e.preventDefault()}>
              <AddToCartButton
                productId={product.id}
                productName={product.name}
                className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-1.5 rounded-lg text-xs h-8"
                size="sm"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
