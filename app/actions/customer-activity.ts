"use server"

import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

export interface CustomerActivityRow {
  id: number
  event_type: "search" | "category_view" | "brand_view"
  user_id: number | null
  ip_address: string | null
  user_agent: string | null
  created_at: string | null
  query: string | null
  results_count: number | null
  category_id: number | null
  category_name: string | null
  category_slug: string | null
  brand_id: number | null
  brand_name: string | null
}

export interface CustomerActivityListResponse {
  success: boolean
  data: CustomerActivityRow[]
  pagination: { page: number; per_page: number; total: number; total_pages: number }
}

export interface CustomerActivitySummary {
  success: boolean
  totals: { search: number; category_view: number; brand_view: number }
  top_searches: Array<{ query: string; count: number; last_results: number | null }>
  top_categories: Array<{ category_id: number | null; name: string | null; slug: string | null; count: number }>
  top_brands: Array<{ brand_id: number | null; name: string | null; count: number }>
}

export interface CustomerActivityListParams {
  type?: "all" | "search" | "category_view" | "brand_view"
  period?: "today" | "week" | "month" | "3months" | "all" | "custom"
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  per_page?: number
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

function buildQS(params: Record<string, string | number | undefined>): string {
  const usp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === null) continue
    usp.append(k, String(v))
  }
  return usp.toString() ? `?${usp.toString()}` : ""
}

export async function getCustomerActivity(
  params: CustomerActivityListParams = {},
): Promise<CustomerActivityListResponse> {
  const qs = buildQS({
    type: params.type ?? "all",
    period: params.period ?? "today",
    date_from: params.date_from,
    date_to: params.date_to,
    search: params.search,
    page: params.page ?? 1,
    per_page: params.per_page ?? 50,
  })
  const res = await fetch(getApiUrl(`/api/admin/customer-activity${qs}`), {
    method: "GET",
    headers: await getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    return { success: false, data: [], pagination: { page: 1, per_page: 50, total: 0, total_pages: 0 } }
  }
  return await res.json()
}

export async function getCustomerActivitySummary(
  params: Pick<CustomerActivityListParams, "period" | "date_from" | "date_to"> & { limit?: number } = {},
): Promise<CustomerActivitySummary> {
  const qs = buildQS({
    period: params.period ?? "today",
    date_from: params.date_from,
    date_to: params.date_to,
    limit: params.limit ?? 20,
  })
  const res = await fetch(getApiUrl(`/api/admin/customer-activity/summary${qs}`), {
    method: "GET",
    headers: await getAuthHeaders(),
    cache: "no-store",
  })
  if (!res.ok) {
    return {
      success: false,
      totals: { search: 0, category_view: 0, brand_view: 0 },
      top_searches: [],
      top_categories: [],
      top_brands: [],
    }
  }
  return await res.json()
}
