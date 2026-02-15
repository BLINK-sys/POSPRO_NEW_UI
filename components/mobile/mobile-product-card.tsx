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
    availability_status?: { status_name: string; background_color: string; text_color: string }
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

            {product.status && (
              <Badge
                className="absolute top-1 left-1 text-[10px] px-1.5 py-0.5"
                style={{ backgroundColor: product.status.background_color, color: product.status.text_color }}
              >
                {product.status.name}
              </Badge>
            )}

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

          <p className="text-xs font-medium text-gray-900 dark:text-gray-100 line-clamp-2 mb-1 leading-tight min-h-[2rem]">
            {product.name}
          </p>

          {product.brand_info?.name && (
            <p className="text-[10px] text-gray-500 mb-1">{product.brand_info.name}</p>
          )}

          <p className={`text-sm font-bold ${getRetailPriceClass(product.price, wholesaleUser)}`}>
            {formatProductPrice(product.price)}
          </p>

          {wholesaleUser && product.wholesale_price && (
            <p className={`text-xs font-bold ${getWholesalePriceClass()}`}>
              Опт: {formatProductPrice(product.wholesale_price)}
            </p>
          )}

          {product.availability_status && (
            <span
              className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: product.availability_status.background_color,
                color: product.availability_status.text_color,
              }}
            >
              {product.availability_status.status_name}
            </span>
          )}

          <div className="mt-2" onClick={(e) => e.preventDefault()}>
            <AddToCartButton
              productId={product.id}
              productName={product.name}
              className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-1.5 rounded-lg text-xs h-8"
              size="sm"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
