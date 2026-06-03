'use client'

import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useKP } from '@/context/kp-context'
import { useAddToKP } from '@/hooks/use-add-to-kp'

interface AddToKPButtonProps {
  productId: number
  productName: string
  productSlug: string
  productPrice: number
  productWholesalePrice?: number | null
  productImageUrl?: string
  productDescription?: string
  productArticle?: string
  productBrandName?: string
  productSupplierName?: string | null
  productCharacteristics?: Array<{ key: string; value: string }>
  disabled?: boolean
  className?: string
  variant?: "default" | "ghost" | "outline" | "secondary"
  size?: "sm" | "default" | "lg"
  showText?: boolean
}

export function AddToKPButton({
  productId,
  productName,
  productSlug,
  productPrice,
  productWholesalePrice,
  productImageUrl,
  productDescription,
  productArticle,
  productBrandName,
  productSupplierName,
  productCharacteristics,
  disabled = false,
  className,
  size = "default",
  showText = true
}: AddToKPButtonProps) {
  const { user } = useAuth()
  const { kpItems } = useKP()
  const addToKP = useAddToKP()

  const isSystemUser = user?.role === "admin" || user?.role === "system"

  if (!isSystemUser) {
    return null
  }

  // Считаем сколько раз этот товар уже в КП (`addItem` создаёт отдельную
  // запись на каждый клик, поэтому один и тот же product может встречаться
  // несколько раз). Сумма количеств — это сколько штук «уже накидано».
  const inKpCount = kpItems
    .filter(item => item.id === productId)
    .reduce((sum, item) => sum + (item.quantity || 0), 0)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    await addToKP({
      id: productId,
      name: productName,
      slug: productSlug,
      price: productPrice,
      wholesale_price: productWholesalePrice,
      image_url: productImageUrl,
      description: productDescription,
      article: productArticle,
      brand_name: productBrandName,
      supplier_name: productSupplierName,
      characteristics: productCharacteristics,
    })
  }

  // Бейдж кладём ВНУТРЬ Button с absolute-позиционированием — тогда внешний
  // w-full из className работает как ожидается (раньше был wrapper-div с
  // inline-flex, который ломал ширину в карточках поиска).
  return (
    <Button
      variant="outline"
      size={size}
      className={(className?.replace(/bg-brand-yellow/, 'bg-transparent').replace(/hover:bg-yellow-500/, 'hover:bg-brand-yellow/10') || '') + ' border-brand-yellow text-black relative'}
      onClick={handleClick}
      disabled={disabled}
    >
      <FileText className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
      {showText && "Для КП"}
      {/* Бейдж количества — сколько штук этого товара уже в КП. */}
      {inKpCount > 0 && (
        <span
          className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand-yellow text-black text-[11px] font-bold border-2 border-white shadow pointer-events-none"
          title={`В КП: ${inKpCount} шт.`}
        >
          {inKpCount > 99 ? '99+' : inKpCount}
        </span>
      )}
    </Button>
  )
}
