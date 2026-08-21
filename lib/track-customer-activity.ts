/**
 * Клиентский трекинг активности покупателей.
 *
 * Три типа событий:
 *   - 'search'         → { query, results_count }
 *   - 'category_view'  → { category_id, category_name?, category_slug? }
 *   - 'brand_view'     → { brand_id, brand_name? }
 *
 * Защита от админов — на ДВУХ уровнях:
 *   1) Клиент (useCustomerActivityTracker / хуки): если auth-context
 *      говорит role === 'admin' | 'system' — вообще ничего не шлём.
 *   2) Бэк (POST /api/track-customer-activity): читает JWT (optional),
 *      если role admin/system — тихо игнорирует запрос.
 *
 * JWT для клиента лежит НЕ в localStorage, а в cookie `jwt-token-client`
 * (не httpOnly — специально для клиентского фетча). Хелпер читает
 * оттуда, чтобы бэк корректно резолвил user_id и role.
 */

"use client"

import { useCallback, useEffect } from "react"
import { getApiUrl } from "@/lib/api-address"
import { useAuth } from "@/context/auth-context"

export type CustomerActivityPayload =
  | { event_type: "search"; query: string; results_count?: number }
  | { event_type: "category_view"; category_id: number; category_name?: string; category_slug?: string }
  | { event_type: "brand_view"; brand_id: number; brand_name?: string }

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"))
  return match ? decodeURIComponent(match[1]) : null
}

/** Fire-and-forget POST. Ошибки заглушаем — трекинг не должен ломать UX. */
export function trackCustomerActivity(payload: CustomerActivityPayload): void {
  if (typeof window === "undefined") return

  const token = readCookie("jwt-token-client")
  const headers: HeadersInit = { "Content-Type": "application/json" }
  if (token) headers.Authorization = `Bearer ${token}`

  const body = JSON.stringify({
    ...payload,
    user_agent: navigator.userAgent,
  })

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

/** Хук: возвращает track-функцию, которая учитывает роль текущего юзера. */
export function useCustomerActivityTracker() {
  const { user } = useAuth()
  const isSystemUser = user?.role === "admin" || user?.role === "system"

  return useCallback(
    (payload: CustomerActivityPayload) => {
      if (isSystemUser) return
      trackCustomerActivity(payload)
    },
    [isSystemUser],
  )
}

/** Хук: трекать category_view один раз при смене id (пропускает админов). */
export function useTrackCategoryView(
  categoryId: number | null | undefined,
  categoryName?: string,
  categorySlug?: string,
) {
  const track = useCustomerActivityTracker()
  useEffect(() => {
    if (!categoryId) return
    track({
      event_type: "category_view",
      category_id: categoryId,
      category_name: categoryName,
      category_slug: categorySlug,
    })
  }, [categoryId, categoryName, categorySlug, track])
}

/** Хук: трекать brand_view один раз при смене id (пропускает админов). */
export function useTrackBrandView(brandId: number | null | undefined, brandName?: string) {
  const track = useCustomerActivityTracker()
  useEffect(() => {
    if (!brandId) return
    track({
      event_type: "brand_view",
      brand_id: brandId,
      brand_name: brandName,
    })
  }, [brandId, brandName, track])
}
