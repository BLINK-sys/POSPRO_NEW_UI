'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Loader2 } from 'lucide-react'
import { addToCart } from '@/app/actions/cart'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { useCart } from '@/context/cart-context'
import { useRouter } from 'next/navigation'

interface AddToCartButtonProps {
  productId: number
  productName: string
  quantity?: number
  disabled?: boolean
  className?: string
  variant?: "default" | "ghost" | "outline" | "secondary"
  size?: "sm" | "default" | "lg"
  showText?: boolean
}

export function AddToCartButton({
  productId,
  productName,
  quantity = 1,
  disabled = false,
  className,
  variant = "default",
  size = "default",
  showText = true
}: AddToCartButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()
  const { user } = useAuth()
  const { updateCartCount } = useCart()
  const router = useRouter()

  // Скрываем кнопку для системных пользователей (админ, модератор)
  if (user && user.role !== 'client') {
    return null
  }

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Проверяем авторизацию
    if (!user) {
      toast({
        title: 'Требуется авторизация',
        description: 'Войдите в аккаунт, чтобы добавить товар в корзину',
        variant: 'destructive'
      })
      router.push('/auth')
      return
    }

    // Проверяем роль пользователя
    if (user.role !== 'client') {
      toast({
        title: 'Доступ запрещен',
        description: 'Только клиенты могут добавлять товары в корзину',
        variant: 'destructive'
      })
      return
    }

    setIsLoading(true)
    try {
      const result = await addToCart(productId, quantity)
      
      if (result.success) {
        toast({
          title: 'Успешно!',
          description: `${productName} добавлен в корзину`
        })
        // Обновляем счетчик корзины
        await updateCartCount()
      } else {
        toast({
          title: 'Ошибка',
          description: result.message || 'Не удалось добавить товар в корзину',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Ошибка добавления в корзину:', error)
      toast({
        title: 'Ошибка',
        description: 'Произошла ошибка при добавлении товара в корзину',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleAddToCart}
      disabled={disabled || isLoading}
    >
      {isLoading ? (
        <Loader2 className={`h-4 w-4 animate-spin ${showText ? "mr-2" : ""}`} />
      ) : (
        <ShoppingCart className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
      )}
      {showText && "В корзину"}
    </Button>
  )
}
