/**
 * Клиентский трекинг активности покупателей.
 *
 * Три типа событий:
 *   - 'search'         → { query, results_count }
 *   - 'category_view'  → { category_id, category_name?, category_slug? }
 *   - 'brand_view'     → { brand_id, brand_name? }
 *
 * Бэк сам режет админ/system-юзеров (через JWT optional) и ботов.
 * На клиенте мы дополнительно ничего не блокируем — единственная
 * оптимизация, чтобы не спамить: `useTrackCategoryView` / `useTrackBrandView`
 * шлют один запрос на входные значения (id меняется → новый запрос).
 */

"use client"

import { useEffect } from "react"
import { getApiUrl } from "@/lib/api-address"

export type CustomerActivityPayload =
  | { event_type: "search"; query: string; results_count?: number }
  | { event_type: "category_view"; category_id: number; category_name?: string; category_slug?: string }
  | { event_type: "brand_view"; brand_id: number; brand_name?: string }

/** Fire-and-forget POST на бэк. Ошибки заглушаем — трекинг не должен ломать UX. */
export function trackCustomerActivity(payload: CustomerActivityPayload): void {
  if (typeof window === "undefined") return

  const token = window.localStorage.getItem("jwt-token")
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  const body = JSON.stringify({
    ...payload,
    user_agent: navigator.userAgent,
  })

  // fetch with keepalive — чтобы запрос успел уйти даже если юзер сразу ушёл со страницы.
  try {
    fetch(getApiUrl("/api/track-customer-activity"), {
      method: "POST",
      headers,
      body,
      keepalive: true,
    }).catch(() => {})
  } catch {
    // ignore
  }
}

/** Хук: трекать category_view один раз при смене id. */
export function useTrackCategoryView(
  categoryId: number | null | undefined,
  categoryName?: string,
  categorySlug?: string,
) {
  useEffect(() => {
    if (!categoryId) return
    trackCustomerActivity({
      event_type: "category_view",
      category_id: categoryId,
      category_name: categoryName,
      category_slug: categorySlug,
    })
  }, [categoryId, categoryName, categorySlug])
}

/** Хук: трекать brand_view один раз при смене id. */
export function useTrackBrandView(brandId: number | null | undefined, brandName?: string) {
  useEffect(() => {
    if (!brandId) return
    trackCustomerActivity({
      event_type: "brand_view",
      brand_id: brandId,
      brand_name: brandName,
    })
  }, [brandId, brandName])
}
