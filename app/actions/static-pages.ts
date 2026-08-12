"use server"

import { cookies } from "next/headers"
import { revalidateTag } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

/**
 * Server-actions для админки статических страниц (Оплата и доставка,
 * О компании, и т.п.). Модель `StaticPage` — одна запись на slug,
 * контент = HTML от TipTap.
 *
 * Публичное чтение — прямым fetch из page.tsx (см. app/pay-delivery/page.tsx),
 * без action-обёртки, чтобы использовать Next `revalidate` через `next.tags`.
 */

export interface StaticPage {
  slug: string
  title: string
  content: string
  is_active: boolean
  updated_at?: string | null
}

const authHeaders = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  }
}

export async function getStaticPage(slug: string): Promise<StaticPage | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/static-page/${encodeURIComponent(slug)}`, {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function saveStaticPage(
  slug: string,
  payload: { title?: string; content?: string; is_active?: boolean }
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/static-page/${encodeURIComponent(slug)}`, {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { success: false, error: j.error || j.message || "Ошибка сохранения" }
    }
    // Публичная страница читается через тег `static-page:<slug>` (см. page.tsx)
    revalidateTag(`static-page:${slug}`)
    return { success: true }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}
