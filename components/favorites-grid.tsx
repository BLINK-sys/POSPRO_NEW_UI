"use client"

import { FavoriteButton } from "@/components/favorite-button"
import { ProductCard } from "@/components/product-card"
import type { Favorite as FavoriteItem } from "@/app/actions/favorites"

interface FavoritesGridProps {
  favorites: FavoriteItem[]
  onFavoriteRemoved?: (productId: number) => void
}

export function FavoritesGrid({ favorites, onFavoriteRemoved }: FavoritesGridProps) {
  if (favorites.length === 0) {
    return null
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
      {favorites.map((favorite) => (
        <div key={favorite.id} className="flex flex-col">
          <ProductCard
            product={favorite.product as any}
            favoriteButton={
              <FavoriteButton
                productId={favorite.product.id}
                productName={favorite.product.name}
                className="w-7 h-7 bg-white/95 hover:bg-white rounded-full shadow-md hover:shadow-lg"
                size="sm"
                initialFavoriteStatus={true}
                onToggleSuccess={(isNowFavorite) => {
                  if (!isNowFavorite && onFavoriteRemoved) {
                    onFavoriteRemoved(favorite.product.id)
                  }
                }}
              />
            }
          />
          <div className="text-[10px] text-muted-foreground text-center mt-1">
            Добавлено: {new Date(favorite.created_at).toLocaleDateString("ru-RU")}
          </div>
        </div>
      ))}
    </div>
  )
}
