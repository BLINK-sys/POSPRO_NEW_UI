"use client"

import Image from "next/image"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { getImageUrl } from "@/lib/image-utils"
import type { Favorite as FavoriteItem } from "@/app/actions/favorites"

interface FavoritesGridProps {
  favorites: FavoriteItem[]
  onFavoriteRemoved?: (productId: number) => void
}

export function FavoritesGrid({ favorites, onFavoriteRemoved }: FavoritesGridProps) {

  // Создаем FavoriteButton для страницы избранного (как на главной странице)
  const FavoriteButtonForFavoritePage = ({ productId, productName }: { productId: number, productName: string }) => {
    return (
      <FavoriteButton
        productId={productId}
        productName={productName}
        className="w-8 h-8 bg-white/90 hover:bg-white rounded-full shadow-md"
        size="sm"
        initialFavoriteStatus={true} // на странице избранного товар точно в избранном
        onToggleSuccess={(isNowFavorite) => {
          if (!isNowFavorite && onFavoriteRemoved) {
            // Если товар удален из избранного, уведомляем родительский компонент
            onFavoriteRemoved(productId)
          }
        }}
      />
    )
  }

  if (favorites.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {favorites.map((favorite) => {
        const brandInfo = favorite.product.brand_info || null
        const statusInfo = favorite.product.status || null
        const availabilityStatus =
          favorite.product.availability_status ||
          (typeof favorite.product.quantity === "number"
            ? favorite.product.quantity > 0
              ? {
                  status_name: "Есть в наличии",
                  background_color: "#10b981",
                  text_color: "#ffffff",
                }
              : {
                  status_name: "Нет в наличии",
                  background_color: "#ef4444",
                  text_color: "#ffffff",
                }
            : null)

        return (
          <div key={favorite.id} className="group">
            <Link href={`/product/${favorite.product.slug}`}>
              <Card className="hover:shadow-[0_8px_24px_rgba(0,0,0,0.25)] hover:scale-105 transition-all duration-300 cursor-pointer bg-white rounded-xl border-0 shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
                <CardContent className="p-3">
                  <div className="relative">
                    <div className="aspect-square relative bg-white rounded-lg overflow-hidden mb-3">
                      {favorite.product.image_url ? (
                        <Image
                          src={getImageUrl(favorite.product.image_url)}
                          alt={favorite.product.name}
                          fill
                          className="object-contain group-hover:scale-110 transition-transform duration-300"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <div className="text-gray-400 text-2xl">📦</div>
                        </div>
                      )}

                      {statusInfo && (
                        <div className="absolute top-2 left-2 z-10">
                          <Badge
                            className="text-xs px-2 py-1 shadow-md"
                            style={{
                              backgroundColor: statusInfo.background_color,
                              color: statusInfo.text_color,
                            }}
                          >
                            {statusInfo.name}
                          </Badge>
                        </div>
                      )}

                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                        <FavoriteButtonForFavoritePage
                          productId={favorite.product.id}
                          productName={favorite.product.name}
                        />
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="p-3 w-full">
                          {brandInfo?.name && (
                            <div className="text-xs text-white mb-1">
                              <span className="font-medium">Бренд:</span> {brandInfo.name}
                            </div>
                          )}
                          {brandInfo?.country && (
                            <div className="text-xs text-white mb-1">
                              <span className="font-medium">Страна:</span> {brandInfo.country}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Товар:</span> {favorite.product.name}
                      </div>

                      {favorite.product.price ? (
                        <div className="text-xs font-bold text-green-600">
                          <span className="font-medium">Цена:</span>{" "}
                          {favorite.product.price.toLocaleString()} тг
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600">Цена не указана</div>
                      )}

                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Наличие:</span>{" "}
                        {availabilityStatus ? (
                          <span
                            style={{
                              backgroundColor: availabilityStatus.background_color,
                              color: availabilityStatus.text_color,
                              padding: "3px 8px",
                              borderRadius: "4px",
                              fontSize: "12px",
                            }}
                          >
                            {availabilityStatus.status_name}
                          </span>
                        ) : (
                          <span>Наличие уточняйте</span>
                        )}
                      </div>

                      <AddToCartButton
                        productId={favorite.product.id}
                        productName={favorite.product.name}
                        className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-medium py-2 px-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 text-xs"
                        size="sm"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            <div className="text-xs text-muted-foreground text-center mt-2">
              Добавлено: {new Date(favorite.created_at).toLocaleDateString("ru-RU")}
            </div>
          </div>
        )
      })}
    </div>
  )
}
