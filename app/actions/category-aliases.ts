"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

// ── Types ──────────────────────────────────────

export interface CategoryAliasCategoryRef {
  id: number
  name: string
  slug: string
  parent_id: number | null
}

export interface CategoryAliasItem {
  id: number
  source: string | null // 'bio' / 'equip' / null (manual)
  parent_id: number | null
  alias_name: string
  category_id: number
  category: CategoryAliasCategoryRef | null
  is_auto: boolean
  needs_review: boolean
  created_at: string | null
}

export interface SimilarPair {
  a: CategoryAliasCategoryRef & { products_count: number }
  b: CategoryAliasCategoryRef & { products_count: number }
  ratio: number
  parent_id: number | null
}

// ── Helpers ─────────────────────────────────────

async function getToken(): Promise<string> {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

const BASE = `${API_BASE_URL}/api/admin`

// ── List / CRUD aliases ─────────────────────────

export async function listCategoryAliases(params: {
  source?: string
  needs_review?: boolean
  is_auto?: boolean
  category_id?: number
  q?: string
} = {}): Promise<CategoryAliasItem[]> {
  const token = await getToken()
  const search = new URLSearchParams()
  if (params.source) search.set("source", params.source)
  if (params.needs_review) search.set("needs_review", "1")
  if (params.is_auto) search.set("is_auto", "1")
  if (params.category_id) search.set("category_id", String(params.category_id))
  if (params.q) search.set("q", params.q)

  const res = await fetch(`${BASE}/category-aliases?${search.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const body = await res.json()
  return body.items || []
}

export async function createCategoryAlias(payload: {
  alias_name: string
  category_id: number
  source?: string | null
  parent_id?: number | null
}): Promise<{ success: boolean; error?: string; item?: CategoryAliasItem }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/category-aliases`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, error: data.error || "Ошибка создания алиаса" }
  revalidatePath("/admin/catalog/categories/aliases")
  return { success: true, item: data }
}

export async function updateCategoryAlias(
  id: number,
  patch: { category_id?: number; needs_review?: boolean },
): Promise<{ success: boolean; error?: string }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/category-aliases/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(patch),
    cache: "no-store",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { success: false, error: data.error || "Ошибка обновления" }
  }
  revalidatePath("/admin/catalog/categories/aliases")
  return { success: true }
}

export async function deleteCategoryAlias(id: number): Promise<{ success: boolean; error?: string }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/category-aliases/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    return { success: false, error: data.error || "Ошибка удаления" }
  }
  revalidatePath("/admin/catalog/categories/aliases")
  return { success: true }
}

// ── Merge / find similar ────────────────────────

export async function mergeCategories(
  source_id: number,
  target_id: number,
): Promise<{ success: boolean; error?: string; products_moved?: number; aliases_relinked?: number }> {
  const token = await getToken()
  const res = await fetch(`${BASE}/categories/merge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ source_id, target_id }),
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, error: data.error || "Ошибка merge" }
  revalidatePath("/admin/catalog/categories")
  revalidatePath("/admin/catalog/categories/aliases")
  return { success: true, ...data }
}

export async function mergeExactDuplicates(): Promise<{
  success: boolean
  error?: string
  groups_merged?: number
  categories_removed?: number
  products_moved?: number
  aliases_relinked?: number
}> {
  const token = await getToken()
  const res = await fetch(`${BASE}/categories/merge-exact-duplicates`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) return { success: false, error: data.error || "Ошибка автомерджа" }
  revalidatePath("/admin/catalog/categories")
  revalidatePath("/admin/catalog/categories/aliases")
  return { success: true, ...data }
}

export async function findSimilarCategories(threshold = 0.85): Promise<SimilarPair[]> {
  const token = await getToken()
  const res = await fetch(`${BASE}/categories/find-similar?threshold=${threshold}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  })
  if (!res.ok) return []
  const body = await res.json()
  return body.items || []
}
