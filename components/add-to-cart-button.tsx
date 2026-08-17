'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Check, Loader2 } from 'lucide-react'
import { addToCart } from '@/app/actions/cart'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/auth-context'
import { useCart } from '@/context/cart-context'
import { cn } from '@/lib/utils'

interface AddToCartButtonProps {
  productId: number
  productName: string
  productSlug?: string
  productPrice?: number
  productImageUrl?: string | null
  productArticle?: string
  quantity?: number
  disabled?: boolean
  className?: string
  variant?: "default" | "ghost" | "outline" | "secondary"
  size?: "sm" | "default" | "lg"
  showText?: boolean
  children?: React.ReactNode
}

export function AddToCartButton({
  productId,
  productName,
  productSlug = '',
  productPrice = 0,
  productImageUrl = null,
  productArticle = '',
  quantity = 1,
  disabled = false,
  className,
  variant = "default",
  size = "default",
  showText = true,
  children
}: AddToCartButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const { user } = useAuth()
  const { updateCartCount, addToGuestCart, cartProductIds } = useCart()

  // Скрываем кнопку для системных пользователей (админ, модератор)
  if (user && user.role !== 'client') {
    return null
  }

  const inCart = cartProductIds.has(productId)

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Товар уже в корзине — не добавляем повторно, а ведём в саму корзину.
    if (inCart) {
      router.push('/profile/cart')
      return
    }

    // Гостевая корзина — сохраняем в localStorage
    if (!user) {
      addToGuestCart({
        product_id: productId,
        product_name: productName,
        product_slug: productSlug,
        product_price: productPrice,
        product_image_url: productImageUrl,
        product_article: productArticle,
      }, quantity)
      toast({
        title: 'Добавлено!',
        description: `${productName} добавлен в корзину`
      })
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

  // В состоянии "уже в корзине" переопределяем цвета (белый фон + чёрная
  // рамка + чёрный текст) поверх переданного `className` — twMerge из cn
  // корректно вытеснит bg-brand-yellow/hover-класс из родительского стиля.
  const inCartClassName = inCart
    ? "bg-white text-black border-2 border-black hover:bg-gray-50 hover:text-black"
    : ""

  return (
    <Button
      variant={variant}
      size={size}
      className={cn(className, inCartClassName)}
      onClick={handleAddToCart}
      disabled={disabled || isLoading}
    >
      {children ? (
        isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : children
      ) : (
        <>
          {isLoading ? (
            <Loader2 className={`h-4 w-4 animate-spin ${showText ? "mr-2" : ""}`} />
          ) : inCart ? (
            <Check className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
          ) : (
            <ShoppingCart className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
          )}
          {showText && (inCart ? "В корзине" : "В корзину")}
        </>
      )}
    </Button>
  )
}
