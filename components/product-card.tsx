"use client"

import { ReactNode } from "react"
import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ProductData } from "@/app/actions/public"
import { getImageUrl } from "@/lib/image-utils"
import { getSuppliersText, getWinningWarehouseSuffix } from "@/lib/product-helpers"
import { useAuth } from "@/context/auth-context"
import {
  formatProductPrice,
  getRetailPriceClass,
  getWholesalePriceClass,
  isWholesaleUser,
} from "@/lib/utils"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { AddToKPButton } from "@/components/add-to-kp-button"
import { QuickViewButton } from "@/components/quick-view-modal"
import { CompareButton } from "@/components/compare-button"
import { CardAdminEditButton } from "@/components/card-admin-edit-button"
import { formatAvailabilityStatusLabel } from "@/lib/availability-status-format"

export interface ProductCardProps {
  product: ProductData
  /** Показывать AddToKPButton (для search/ai). Сама кнопка внутри проверяет роль. */
  showKP?: boolean
  /** Кастомная кнопка «Избранное» (например для страницы избранного). */
  favoriteButton?: ReactNode
  /** Доп. футер под кнопкой корзины (например «Добавлено: dd.mm.yyyy»). */
  extraFooter?: ReactNode
}

/**
 * Единая карточка товара (grid-плитка). Эталон стиля — блок товаров на
 * главной. Использовать вместо inline-разметки в: поиске, категории (grid),
 * бренде, избранном, AI-странице.
 *
 * Верстка полностью повторяет `renderProductItem` из `homepage-block.tsx`,
 * поэтому визуальные изменения ведём в одном месте.
 */
export function ProductCard({
  product,
  showKP = false,
  favoriteButton,
  extraFooter,
}: ProductCardProps) {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  const isSystemUser = user?.role === "admin" || user?.role === "system"

  return (
    <div className="group h-full">
      <Link href={`/product/${product.slug}`} className="block h-full">
        <Card className="h-full flex flex-col hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-[1.02] transition-all duration-300 cursor-pointer bg-white rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
          <CardContent className="p-1.5 flex flex-col h-full">
            <div className="relative flex flex-col h-full">
              <div className="aspect-[3/2] relative bg-white rounded-lg overflow-hidden mb-1 shrink-0">
                {product.image_url ? (
                  <Image
                    src={getImageUrl(product.image_url)}
                    alt={product.name}
                    fill
                    className="object-contain group-hover:scale-110 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-gray-400 text-2xl">📦</div>
                  </div>
                )}

                {product.status && (
                  <div className="absolute top-2 left-2 z-10">
                    <Badge
                      className="text-xs px-2 py-1 shadow-md"
                      style={{
                        backgroundColor: product.status.background_color,
                        color: product.status.text_color,
                      }}
                    >
                      {product.status.name}
                    </Badge>
                  </div>
                )}

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10 flex flex-col gap-1">
                  <QuickViewButton slug={product.slug} iconOnly />
                  {favoriteButton ?? (
                    <FavoriteButton
                      productId={product.id}
                      productName={product.name}
                      className="w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-md hover:shadow-lg"
                      size="sm"
                    />
                  )}
                  <CompareButton
                    productId={product.id}
                    productName={product.name}
                    productSlug={product.slug}
                    categoryId={product.category_id ?? (product.category as any)?.id}
                    categoryName={
                      typeof product.category === "string"
                        ? product.category
                        : product.category?.name
                    }
                  />
                  <CardAdminEditButton
                    entityType="product"
                    entityId={product.id}
                    entitySlug={product.slug}
                    entityName={product.name}
                  />
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="p-3 w-full">
                    {product.brand_info && (
                      <div className="text-xs text-white mb-1">
                        <span className="font-medium">Бренд:</span> {product.brand_info.name}
                      </div>
                    )}
                    {product.brand_info?.country && (
                      <div className="text-xs text-white mb-1">
                        <span className="font-medium">Страна:</span> {product.brand_info.country}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col flex-1 gap-0.5">
                <div className="text-[11px] text-gray-700 line-clamp-2 leading-tight">
                  <span className="font-medium">Товар:</span> {product.name}
                </div>

                <div className={`text-[11px] font-bold ${getRetailPriceClass(wholesaleUser)}`}>
                  <span className="font-medium">Цена:</span>{" "}
                  {formatProductPrice(product.price)}
                  {getWinningWarehouseSuffix(product as any, isSystemUser)}
                </div>

                {wholesaleUser && (
                  <div className={`text-[11px] font-bold ${getWholesalePriceClass()}`}>
                    <span className="font-medium">Оптовая цена:</span>{" "}
                    {formatProductPrice(product.wholesale_price)}
                  </div>
                )}

                <div className="text-[11px] text-gray-600">
                  <span className="font-medium">Наличие:</span>{" "}
                  {product.availability_status ? (
                    <span
                      style={{
                        backgroundColor: product.availability_status.background_color,
                        color: product.availability_status.text_color,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "10px",
                      }}
                    >
                      {formatAvailabilityStatusLabel(product.availability_status)}
                    </span>
                  ) : (
                    <span>{product.quantity} шт.</span>
                  )}
                </div>

                {isSystemUser && (() => {
                  const txt = getSuppliersText(product as any)
                  return txt ? (
                    <div className="text-[10px] text-gray-500 truncate">
                      <span className="font-medium">Поставщик:</span> {txt}
                    </div>
                  ) : null
                })()}

                <div className="mt-auto pt-1.5 flex flex-col gap-1">
                  <AddToCartButton
                    productId={product.id}
                    productName={product.name}
                    productSlug={product.slug}
                    productPrice={product.price}
                    productImageUrl={product.image_url}
                    productArticle={(product as any).article || ""}
                    className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-1.5 px-2 rounded-lg shadow hover:shadow-md transition-all text-[11px]"
                    size="sm"
                  />
                  {showKP && (
                    <AddToKPButton
                      productId={product.id}
                      productName={product.name}
                      productSlug={product.slug}
                      productPrice={product.price}
                      productWholesalePrice={product.wholesale_price}
                      productImageUrl={product.image_url}
                      productDescription={product.description}
                      productArticle={(product as any).article || ""}
                      productBrandName={product.brand_info?.name}
                      productSupplierName={product.supplier_name}
                      className="w-full text-[11px] py-1.5 px-2 h-auto"
                      size="sm"
                    />
                  )}
                  {extraFooter}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  )
}
