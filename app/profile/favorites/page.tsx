"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { getFavorites, type Favorite } from "@/app/actions/favorites"
import { FavoritesGrid } from "@/components/favorites-grid"
import { useAuth } from "@/context/auth-context"
import { useRouter } from "next/navigation"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

export default function ProfileFavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()

  const loadFavorites = async () => {
    if (!user) return
    
    try {
      setIsLoading(true)
      setError(null)
      const data = await getFavorites()
      setFavorites(data)
    } catch (err) {
      console.error('Ошибка при загрузке избранного:', err)
      setError('Не удалось загрузить список избранных товаров')
    } finally {
      setIsLoading(false)
    }
  }

  // Функция для обновления списка избранного после удаления
  const handleFavoriteRemoved = (productId: number) => {
    setFavorites(prev => prev.filter(fav => fav.product.id !== productId))
  }

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth")
      return
    }

    if (user && user.role === "client") {
      loadFavorites()
    }
  }, [user, authLoading, router])

  // Показываем скелетон пока загружается авторизация
  if (authLoading) {
    return (
      <div className="container py-10">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Если пользователь не авторизован или не клиент
  if (!user || user.role !== "client") {
    return null // useEffect перенаправит
  }

  return (
    <div className="container py-10">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Избранные товары</CardTitle>
              <CardDescription>
                {isLoading 
                  ? "Загрузка..." 
                  : favorites.length > 0 
                    ? `У вас ${favorites.length} товаров в избранном`
                    : "У вас пока нет избранных товаров"
                }
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={loadFavorites}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Обновить
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-6xl mb-4">😞</div>
              <h3 className="text-lg font-semibold mb-2">Ошибка загрузки</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={loadFavorites} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                Попробовать снова
              </Button>
            </div>
          ) : isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square w-full rounded-lg" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : favorites.length > 0 ? (
            <FavoritesGrid 
              favorites={favorites} 
              onFavoriteRemoved={handleFavoriteRemoved}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="text-6xl mb-4">💝</div>
              <h3 className="text-lg font-semibold mb-2">Нет избранных товаров</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Добавьте товары в избранное, нажав на иконку сердца на карточке товара
              </p>
              <Button 
                onClick={() => router.push("/")}
                className="bg-brand-yellow text-black hover:bg-yellow-500"
              >
                Перейти к каталогу
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
