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
 * Хук добавления товара в КП. Возвращает функцию, которая ОТКРЫВАЕТ
 * модалку выбора поставщика — сам addItem вызывается уже внутри
 * KP-контекста после подтверждения. Отмена → ничего не добавляется.
 *
 * До 2026-08-21 хук сам вызывал addItem + асинхронно обогащал
 * warehouse-ценами (juzer тыкает — товар сразу в КП, потом enrichment).
 * Теперь эту последовательность выполняет KPProvider через
 * `startAddToKPWithSupplier`.
 */
export function useAddToKP() {
  const { startAddToKPWithSupplier } = useKP()

  return useCallback((product: AddToKPInput) => {
    startAddToKPWithSupplier(product)
  }, [startAddToKPWithSupplier])
}

/**
 * Устаревший «немедленный» вариант — оставлен на случай сценариев где
 * подтверждение поставщика не нужно (например импорт из истории).
 * Новых мест использования не создавать — вызывайте `useAddToKP`.
 */
export function useAddToKPImmediate() {
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
            // Множитель наценки со склада (для инициализации per-row в корп.расчётнике).
            margin_coef: c.margin_coef ?? null,
            // PWC id и заметка — для корп.расчётника, чтобы кнопкой
            // показывать/редактировать примечание прямо в строке.
            pwc_id: c.id,
            note: c.note,
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
