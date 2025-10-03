"use client"

import { useState, useEffect } from "react"
import { Star } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { toggleFavorite, checkFavoriteStatus } from "@/app/actions/favorites"
import { useAuth } from "@/context/auth-context"

interface FavoriteButtonProps {
  productId: number
  productName: string
  className?: string
  size?: "sm" | "default" | "lg"
  variant?: "default" | "ghost" | "outline" | "secondary"
  showText?: boolean
  onToggleSuccess?: (isNowFavorite: boolean) => void
  initialFavoriteStatus?: boolean
}

export function FavoriteButton({ 
  productId, 
  productName, 
  className,
  size = "default",
  variant = "ghost",
  showText = false,
  onToggleSuccess,
  initialFavoriteStatus
}: FavoriteButtonProps) {
  const [isFavorite, setIsFavorite] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(true)
  const { user } = useAuth()
  const { toast } = useToast()

  // Проверяем статус избранного при загрузке компонента
  useEffect(() => {
    if (initialFavoriteStatus !== undefined) {
      // Если передан начальный статус, используем его
      setIsFavorite(initialFavoriteStatus)
      setIsCheckingStatus(false)
    } else if (user && user.role === "client") {
      checkStatus()
    } else {
      setIsCheckingStatus(false)
    }
  }, [productId, user, initialFavoriteStatus])

  const checkStatus = async () => {
    try {
      setIsCheckingStatus(true)
      const result = await checkFavoriteStatus(productId)
      if (result.success) {
        setIsFavorite(result.is_favorite)
      }
    } catch (error) {
      console.error("Ошибка при проверке статуса избранного:", error)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!user) {
      toast({
        title: "Требуется авторизация",
        description: "Войдите в аккаунт, чтобы добавлять товары в избранное",
        variant: "destructive"
      })
      return
    }

    if (user.role !== "client") {
      toast({
        title: "Недоступно",
        description: "Функция избранного доступна только для клиентов",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await toggleFavorite(productId)

      if (result.success) {
        const newFavoriteStatus = result.is_favorite ?? false
        setIsFavorite(newFavoriteStatus)
        
        // Вызываем callback если он передан
        if (onToggleSuccess) {
          onToggleSuccess(newFavoriteStatus)
        }
        
        // Показываем уведомление только если не используется внешний callback (избегаем дублирования)
        if (!onToggleSuccess) {
          toast({
            title: newFavoriteStatus ? "Добавлено в избранное" : "Удалено из избранного",
            description: newFavoriteStatus 
              ? `${productName} добавлен в избранное`
              : `${productName} удален из избранного`,
          })
        }
      } else {
        toast({
          title: "Ошибка",
          description: result.message || "Не удалось изменить статус избранного",
          variant: "destructive"
        })
      }
    } catch (error) {
      console.error("Ошибка при переключении избранного:", error)
      toast({
        title: "Ошибка",
        description: "Произошла ошибка при изменении статуса избранного",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Не показываем кнопку если пользователь не авторизован или не является клиентом
  if (!user || user.role !== "client") {
    return null
  }

  // Простая кнопка без подтверждения (как на главной странице)
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleToggleFavorite}
      disabled={isLoading || isCheckingStatus}
    >
      <Star 
        className={`h-4 w-4 transition-all duration-200 ${showText ? "mr-2" : ""} ${
          isFavorite 
            ? "stroke-black stroke-2" 
            : "text-gray-600 fill-transparent stroke-gray-600 stroke-2"
        }`}
        style={isFavorite ? { fill: '#ffd700', color: '#ffd700' } : {}}
      />
      {showText && (isFavorite ? "В избранном" : "В избранное")}
    </Button>
  )
}
