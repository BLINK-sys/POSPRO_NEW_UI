"use server"

import { cookies } from "next/headers"
import { revalidateTag } from "next/cache"
import { getApiUrl } from "@/lib/api-address"
import type { SearchPageSettings } from "@/lib/search-page-types"

// Public-чтение делается через /api/public/search-page (route handler),
// не через server action — был баг где server action зависал и promise
// никогда не резолвился. Route handler работает предсказуемо.
// Этот файл оставляем для admin-write actions ниже.

// ─── Admin actions ──────────────────────────────────────────────────────

async function authedFetch(path: string, init?: RequestInit) {
  const token = cookies().get("jwt-token")?.value
  if (!token) throw new Error("Not authenticated")
  return fetch(`${getApiUrl(path)}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  })
}

export async function getSearchPageSettingsAdmin(): Promise<SearchPageSettings> {
  try {
    const res = await authedFetch("/api/admin/search-page/settings")
    if (!res.ok) return { categories_enabled: true, brands_enabled: true }
    return await res.json()
  } catch {
    return { categories_enabled: true, brands_enabled: true }
  }
}

export async function updateSearchPageSettingsAdmin(
  patch: Partial<SearchPageSettings>
): Promise<{ success: boolean; settings?: SearchPageSettings; error?: string }> {
  try {
    const res = await authedFetch("/api/admin/search-page/settings", {
      method: "PUT",
      body: JSON.stringify(patch),
    })
    const data = await res.json()
    if (!res.ok) return { success: false, error: data?.error || "Не удалось сохранить" }
    revalidateTag("search-page")
    return { success: true, settings: data }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function getSearchPageCategoriesAdmin(): Promise<number[]> {
  try {
    const res = await authedFetch("/api/admin/search-page/categories")
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data.map((x: any) => Number(x)).filter(Number.isFinite) : []
  } catch {
    return []
  }
}

export async function updateSearchPageCategoriesAdmin(
  ids: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authedFetch("/api/admin/search-page/categories", {
      method: "PUT",
      body: JSON.stringify(ids),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: data?.error || "Не удалось сохранить" }
    revalidateTag("search-page")
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}

export async function getSearchPageBrandsAdmin(): Promise<number[]> {
  try {
    const res = await authedFetch("/api/admin/search-page/brands")
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data.map((x: any) => Number(x)).filter(Number.isFinite) : []
  } catch {
    return []
  }
}

export async function updateSearchPageBrandsAdmin(
  ids: number[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await authedFetch("/api/admin/search-page/brands", {
      method: "PUT",
      body: JSON.stringify(ids),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { success: false, error: data?.error || "Не удалось сохранить" }
    revalidateTag("search-page")
    return { success: true }
  } catch (e: any) {
    return { success: false, error: e?.message || "Ошибка сети" }
  }
}
