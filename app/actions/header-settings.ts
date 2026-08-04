"use server"

import { cookies } from "next/headers"
import { revalidateTag } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

/**
 * Админские server-actions для управления шапкой сайта:
 *   - HeaderStripSettings — жёлтая строка уведомления
 *   - HeaderMenuItem      — пункты нижней полосы (категории/кастомные разделы)
 *
 * Публичное чтение (для рендера шапки) — `getHeaderData()` в public.ts.
 * После любой мутации триггерим revalidateTag('header') чтобы sticky
 * шапка обновилась у всех пользователей.
 */

export interface HeaderStripSettings {
  strip_enabled: boolean
  strip_text: string
  strip_clickable: boolean
  strip_url: string
  strip_open_new_tab: boolean
}

export interface HeaderMenuItem {
  id: number
  kind: "category" | "custom"
  is_active: boolean
  order: number
  name: string
  slug: string | null
  category_id?: number
  product_ids?: number[]
}

export interface CreateMenuItemPayload {
  kind: "category" | "custom"
  is_active?: boolean
  category_id?: number
  custom_name?: string
  product_ids?: number[]
}

export interface UpdateMenuItemPayload {
  is_active?: boolean
  category_id?: number
  custom_name?: string
  product_ids?: number[]
}

const getToken = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

const authHeaders = async () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${await getToken()}`,
})

// Только revalidateTag('header') — публичный SSR-кэш шапки. Админский
// список в /admin/pages обновляется через локальный refetch (onSaved →
// load()), поэтому revalidatePath не нужен и вредит: он заставляет Next
// перерисовать всю страницу /admin/pages при каждой мутации.
const invalidate = () => {
  revalidateTag("header")
}

// ── Strip settings ─────────────────────────────────────────────────────

export async function getHeaderStripSettings(): Promise<HeaderStripSettings | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/header/settings`, {
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

export async function saveHeaderStripSettings(
  settings: HeaderStripSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/header/settings`, {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify(settings),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { success: false, error: j.error || j.message || "Ошибка сохранения" }
    }
    invalidate()
    return { success: true }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

// ── Menu items ─────────────────────────────────────────────────────────

export async function getHeaderMenuItems(): Promise<HeaderMenuItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/header/menu-items`, {
      method: "GET",
      headers: await authHeaders(),
      cache: "no-store",
    })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

export async function createHeaderMenuItem(
  payload: CreateMenuItemPayload
): Promise<{ success: boolean; error?: string; data?: HeaderMenuItem }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/header/menu-items`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: j.error || j.message || "Ошибка создания" }
    invalidate()
    return { success: true, data: j }
  } catch {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function updateHeaderMenuItem(
  id: number,
  payload: UpdateMenuItemPayload
): Promise<{ success: boolean; error?: string; data?: HeaderMenuItem }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/header/menu-items/${id}`, {
      method: "PUT",
      headers: await authHeaders(),
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: j.error || j.message || "Ошибка обновления" }
    invalidate()
    return { success: true, data: j }
  } catch {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function deleteHeaderMenuItem(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/header/menu-items/${id}`, {
      method: "DELETE",
      headers: await authHeaders(),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { success: false, error: j.error || j.message || "Ошибка удаления" }
    }
    invalidate()
    return { success: true }
  } catch {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function reorderHeaderMenuItems(
  orderedIds: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/header/menu-items/reorder`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify(orderedIds),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return { success: false, error: j.error || j.message || "Ошибка сортировки" }
    }
    invalidate()
    return { success: true }
  } catch {
    return { success: false, error: "Ошибка сети" }
  }
}
