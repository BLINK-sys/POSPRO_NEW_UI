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

  const getImageUrl = (imageUrl?: string) => {
    if (!imageUrl) return "/placeholder.jpg"
    if (imageUrl.startsWith("http")) return imageUrl
    return `${process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:5000"}${imageUrl}`
  }

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
                <div className="aspect-square relative bg-gray-50 rounded-lg overflow-hidden mb-4">
                  <Link href={`/product/${favorite.product.slug}`}>
                    <Image
                      src={getImageUrl(favorite.product.image_url)}
                      alt={favorite.product.name}
                      fill
                      className="object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                  </Link>
                  
                  {/* Статус товара - верхний левый угол */}
                  {favorite.product.status && (
                    <div className="absolute top-3 left-3 z-10">
                      <Badge 
                        className="text-xs px-3 py-1.5 shadow-md"
                        style={{
                          backgroundColor: favorite.product.status.background_color,
                          color: favorite.product.status.text_color
                        }}
                      >
                        {favorite.product.status.name}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Кнопка удаления из избранного - только при наведении */}
                  <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10">
                    <FavoriteButtonForFavoritePage
                      productId={favorite.product.id}
                      productName={favorite.product.name}
                    />
                  </div>
                  
                  {/* Панель с дополнительной информацией при наведении - только снизу */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                    <div className="p-4 w-full">
                      <h3 className="font-medium text-white text-sm mb-1">{favorite.product.name}</h3>
                      <div className="text-xs text-white/90 mb-1">
                        <span className="font-medium">Артикул:</span> {favorite.product.article}
                      </div>
                      {favorite.product.category && (
                        <div className="text-xs text-white/90">
                          <span className="font-medium">Категория:</span> {favorite.product.category.name}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Информация о товаре */}
                <div className="space-y-3">
                  <Link href={`/product/${favorite.product.slug}`}>
                    <h3 className="font-semibold text-gray-900 text-sm line-clamp-2 leading-tight">{favorite.product.name}</h3>
                  </Link>
                  
                  <p className="text-lg font-bold text-gray-900">
                    {favorite.product.price ? `${favorite.product.price.toLocaleString()} тг` : 'Цена не указана'}
                  </p>
                  
                  {/* Кнопка "Добавить в корзину" */}
                  <AddToCartButton
                    productId={favorite.product.id}
                    productName={favorite.product.name}
                    className="w-full bg-brand-yellow hover:bg-yellow-500 text-black font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
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
