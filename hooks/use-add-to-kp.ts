'use client'

import { useCallback } from 'react'
import { useKP } from '@/context/kp-context'
import { getProductBySlug } from '@/app/actions/products'
import { getProductCosts } from '@/app/actions/product-costs'

/**
 * Параметры товара для добавления в КП. Подмножество KPItem'а — id обязателен,
 * остальное добавится при обогащении (fetch warehouse-цен + детали товара).
 */
export interface AddToKPInput {
  id: number
  name: string
  slug: string
  price: number
  wholesale_price?: number | null
  image_url?: string
  description?: string
  article?: string
  brand_name?: string
  supplier_name?: string | null
  characteristics?: Array<{ key: string; value: string }>
}

/**
 * Хук добавления товара в КП. Возвращает функцию, которую можно дёргать из
 * dropdown'ов, контекстных меню, кнопок в админ-таблице — отовсюду, где нет
 * желания/возможности рендерить готовый `<AddToKPButton/>`.
 *
 * Логика та же что в [`components/add-to-kp-button.tsx`](../components/add-to-kp-button.tsx):
 * 1. `addItem` сразу создаёт запись в KPItem'ах (одного товара может быть N штук — каждый раз новая запись с новым `kpId`).
 * 2. Параллельно тянем warehouse-цены и детали товара (если их не передали).
 * 3. `updateItem` обогащает уже добавленную запись данными.
 */
export function useAddToKP() {
  const { addItem, updateItem } = useKP()

  return useCallback(async (product: AddToKPInput): Promise<string> => {
    const kpId = addItem({
      id: product.id,
      name: product.name,
      slug: product.slug,
      price: product.price,
      wholesale_price: product.wholesale_price,
      image_url: product.image_url,
      description: product.description,
      article: product.article,
      brand_name: product.brand_name,
      supplier_name: product.supplier_name,
      characteristics: product.characteristics,
    })

    if (!kpId) return ''

    try {
      const [costs, fullProduct] = await Promise.all([
        getProductCosts({ product_id: product.id }),
        (!product.characteristics?.length || !product.article)
          ? getProductBySlug(product.slug)
          : null,
      ])

      const enrichment: Record<string, any> = {}

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
            // Старые бэки до миграции warehouse.vat_enabled — дефолт true.
            vat_enabled: c.vat_enabled !== false,
          }))
      }

      if (fullProduct) {
        if (fullProduct.characteristics?.length) {
          enrichment.characteristics = fullProduct.characteristics.map(c => ({ key: c.key, value: c.value }))
        }
        if (fullProduct.article && !product.article) {
          enrichment.article = fullProduct.article
        }
        if (fullProduct.description && !product.description) {
          enrichment.description = fullProduct.description
        }
      }

      if (Object.keys(enrichment).length > 0) {
        updateItem(kpId, enrichment)
      }
    } catch (err) {
      console.error('Failed to fetch product details for KP:', err)
    }

    return kpId
  }, [addItem, updateItem])
}
