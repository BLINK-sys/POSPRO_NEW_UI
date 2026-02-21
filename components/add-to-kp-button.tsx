'use client'

import { Button } from '@/components/ui/button'
import { FileText, Check } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useKP } from '@/context/kp-context'
import { getProductBySlug } from '@/app/actions/products'

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
  const { addItem, removeItem, isInKP, updateItem } = useKP()

  const isSystemUser = user?.role === "admin" || user?.role === "system"

  // Скрываем кнопку для не-системных пользователей
  if (!isSystemUser) {
    return null
  }

  const inKP = isInKP(productId)

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (inKP) {
      removeItem(productId)
    } else {
      addItem({
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

      // Auto-fetch full product data (characteristics, article, description)
      if (!productCharacteristics?.length || !productArticle) {
        try {
          const fullProduct = await getProductBySlug(productSlug)
          const enrichment: Record<string, any> = {}
          if (fullProduct.characteristics?.length) {
            enrichment.characteristics = fullProduct.characteristics.map(c => ({ key: c.key, value: c.value }))
          }
          if (fullProduct.article && !productArticle) {
            enrichment.article = fullProduct.article
          }
          if (fullProduct.description && !productDescription) {
            enrichment.description = fullProduct.description
          }
          if (Object.keys(enrichment).length > 0) {
            updateItem(productId, enrichment)
          }
        } catch (err) {
          console.error('Failed to fetch product details for KP:', err)
        }
      }
    }
  }

  return (
    <Button
      variant={inKP ? "default" : "outline"}
      size={size}
      className={inKP
        ? className
        : className?.replace(/bg-brand-yellow/, 'bg-transparent').replace(/hover:bg-yellow-500/, 'hover:bg-brand-yellow/10') + ' border-brand-yellow text-black'
      }
      onClick={handleClick}
      disabled={disabled}
    >
      {inKP ? (
        <Check className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
      ) : (
        <FileText className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
      )}
      {showText && (inKP ? "В КП" : "Для КП")}
    </Button>
  )
}
