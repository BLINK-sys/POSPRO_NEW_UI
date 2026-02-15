"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Star, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getFavorites } from "@/app/actions/favorites"
import { isWholesaleUser } from "@/lib/utils"
import { useAuth } from "@/context/auth-context"
import MobileProductCard from "./mobile-product-card"

export default function MobileFavoritesPage() {
  const { user } = useAuth()
  const wholesaleUser = isWholesaleUser(user)
  const router = useRouter()

  const [favorites, setFavorites] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user || user.role !== "client") {
      router.push("/auth")
      return
    }
    loadFavorites()
  }, [user])

  const loadFavorites = async () => {
    setLoading(true)
    try {
      const data = await getFavorites()
      setFavorites(data || [])
    } catch (error) {
      console.error("Error loading favorites:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleFavoriteToggle = (productId: number, isNowFavorite: boolean) => {
    if (!isNowFavorite) {
      setFavorites(prev => prev.filter(fav => {
        const product = fav.product || fav
        return product.id !== productId
      }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  return (
    <div className="pb-4">
      <div className="px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <h1 className="text-lg font-bold">Избранное</h1>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={loadFavorites}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {favorites.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 px-4 py-3">
          {favorites.map((fav: any) => {
            const product = fav.product || fav
            return (
              <MobileProductCard key={product.id} product={product} wholesaleUser={wholesaleUser} onFavoriteToggle={handleFavoriteToggle} />
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 px-4">
          <Star className="h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold mb-2">Нет избранных товаров</h2>
          <p className="text-sm text-gray-500 mb-4 text-center">Нажмите на звёздочку у товара, чтобы добавить его в избранное</p>
          <Button className="bg-brand-yellow text-black hover:bg-yellow-500" onClick={() => router.push("/")}>
            Перейти в каталог
          </Button>
        </div>
      )}
    </div>
  )
}
