'use client'

import { Button } from '@/components/ui/button'
import { FileText } from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { useKP } from '@/context/kp-context'
import { getProductBySlug } from '@/app/actions/products'
import { getProductCosts } from '@/app/actions/product-costs'

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
  const { addItem, updateItem } = useKP()

  const isSystemUser = user?.role === "admin" || user?.role === "system"

  if (!isSystemUser) {
    return null
  }

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // Always add as new item
    const kpId = addItem({
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

    if (!kpId) return

    // Fetch warehouse prices and product details in parallel
    try {
      const [costs, fullProduct] = await Promise.all([
        getProductCosts({ product_id: productId }),
        (!productCharacteristics?.length || !productArticle)
          ? getProductBySlug(productSlug)
          : null,
      ])

      const enrichment: Record<string, any> = {}

      // Add warehouse prices
      if (costs.length > 0) {
        enrichment.warehousePrices = costs
          .filter(c => c.calculated_price && c.calculated_price > 0)
          .map(c => ({
            warehouse_id: c.warehouse_id,
            warehouse_name: c.warehouse_name || 'Склад',
            supplier_name: c.supplier_name || null,
            cost_price: c.cost_price,
            calculated_price: c.calculated_price,
            calculated_delivery: c.calculated_delivery || null,
            currency_code: c.currency_code || 'KZT',
          }))
      }

      // Enrich with product details
      if (fullProduct) {
        if (fullProduct.characteristics?.length) {
          enrichment.characteristics = fullProduct.characteristics.map(c => ({ key: c.key, value: c.value }))
        }
        if (fullProduct.article && !productArticle) {
          enrichment.article = fullProduct.article
        }
        if (fullProduct.description && !productDescription) {
          enrichment.description = fullProduct.description
        }
      }

      if (Object.keys(enrichment).length > 0) {
        updateItem(kpId, enrichment)
      }
    } catch (err) {
      console.error('Failed to fetch product details for KP:', err)
    }
  }

  return (
    <Button
      variant="outline"
      size={size}
      className={className?.replace(/bg-brand-yellow/, 'bg-transparent').replace(/hover:bg-yellow-500/, 'hover:bg-brand-yellow/10') + ' border-brand-yellow text-black'}
      onClick={handleClick}
      disabled={disabled}
    >
      <FileText className={`h-4 w-4 ${showText ? "mr-2" : ""}`} />
      {showText && "Для КП"}
    </Button>
  )
}
