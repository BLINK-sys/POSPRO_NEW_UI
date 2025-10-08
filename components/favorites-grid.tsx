"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ShoppingCart } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { FavoriteButton } from "@/components/favorite-button"
import { AddToCartButton } from "@/components/add-to-cart-button"
import { getImageUrl } from "@/lib/image-utils"

interface Favorite {
  id: number
  product: {
    id: number
    name: string
    slug: string
    price: number
    article: string
    image_url?: string
    status?: {
      id: number
      name: string
      background_color: string
      text_color: string
    }
    category?: {
      id: number
      name: string
      slug: string
    }
  }
  created_at: string
}

interface FavoritesGridProps {
  favorites: Favorite[]
  onFavoriteRemoved?: (productId: number) => void
}

export function FavoritesGrid({ favorites, onFavoriteRemoved }: FavoritesGridProps) {
  const { toast } = useToast()


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
      {favorites.map((favorite) => (
        <div key={favorite.id} className="group">
          <Card className="hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer bg-white rounded-xl border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="relative">
                {/* Изображение товара */}
                <div className="aspect-square relative bg-white rounded-lg overflow-hidden mb-4">
                  <Link href={`/product/${favorite.product.slug}`}>
                    <Image
                      src={getImageUrl(favorite.product.image_url)}
                      alt={favorite.product.name}
                      fill
                      className="object-contain group-hover:scale-110 transition-transform duration-300"
                    />
                  </Link>
                  
                  {/* Бейдж "PosPro" - верхний левый угол */}
                  <div className="absolute top-3 left-3 z-10">
                    <Badge 
                      className="text-xs px-3 py-1.5 shadow-md bg-[#FDBD00] text-black border-0"
                    >
                      PosPro
                    </Badge>
                  </div>
                  
                  {/* Кнопка избранного - правый верхний угол (только при наведении) */}
                  <div className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <FavoriteButtonForFavoritePage
                      productId={favorite.product.id}
                      productName={favorite.product.name}
                    />
                  </div>
                  
                  {/* Панель с информацией о бренде при наведении - только снизу */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="p-4 w-full">
                      <div className="text-xs text-white mb-1">
                        <span className="font-medium">Бренд:</span> PosPro
                      </div>
                      <div className="text-xs text-white">
                        <span className="font-medium">Страна:</span> Казахстан
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Информация о товаре */}
                <div className="space-y-3">
                  <div className="text-xs text-gray-600">
                    <span className="font-medium">Товар:</span> {favorite.product.name}
                  </div>
                  
                  <div className="text-xs font-bold text-green-600">
                    <span className="font-medium">Цена:</span> {favorite.product.price ? `${favorite.product.price.toLocaleString()} тг` : 'Цена не указана'}
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Наличие:</span>{" "}
                    <span className="bg-green-600 text-white px-2 py-1 rounded text-xs">
                      Есть в наличии
                    </span>
                  </div>
                  
                  {/* Кнопка "В корзину" с иконкой */}
                  <AddToCartButton
                    productId={favorite.product.id}
                    productName={favorite.product.name}
                    className="w-full bg-[#FDBD00] hover:bg-yellow-500 text-black font-medium py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2"
                    size="sm"
                  />
                  
                  {/* Дата добавления в избранное */}
                  <div className="text-xs text-muted-foreground text-center">
                    Добавлено: {new Date(favorite.created_at).toLocaleDateString('ru-RU')}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  )
}
