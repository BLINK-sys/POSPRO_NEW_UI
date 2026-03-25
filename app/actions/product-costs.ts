"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

export interface ProductCost {
  id: number
  product_id: number
  product_name: string | null
  product_article: string | null
  product_slug: string | null
  product_image?: string | null
  warehouse_id: number
  cost_price: number
  calculated_price: number | null
  calculated_at: string | null
  created_at: string | null
  updated_at: string | null
}

export interface ProductCostActionResponse {
  success: boolean
  message?: string
  data?: ProductCost
  error?: string
}

const getToken = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

export async function getProductCosts(params: {
  warehouse_id?: number
  product_id?: number
}): Promise<ProductCost[]> {
  try {
    const token = await getToken()
    const searchParams = new URLSearchParams()
    if (params.warehouse_id) searchParams.set("warehouse_id", String(params.warehouse_id))
    if (params.product_id) searchParams.set("product_id", String(params.product_id))

    const res = await fetch(`${API_BASE_URL}/meta/product-costs/?${searchParams}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    const response = await res.json()
    return response.data || []
  } catch (e) {
    console.error("Error fetching product costs:", e)
    return []
  }
}

export async function createProductCost(data: {
  product_id: number
  warehouse_id: number
  cost_price: number
}): Promise<ProductCostActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/product-costs/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка добавления себестоимости" }
    }
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function updateProductCost(
  id: number,
  data: { cost_price: number }
): Promise<ProductCostActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/product-costs/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка обновления себестоимости" }
    }
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function deleteProductCost(id: number): Promise<ProductCostActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/product-costs/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка удаления" }
    }
    return { success: true, message: result.message }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function bulkCreateCosts(data: {
  warehouse_id: number
  items: { product_id: number; cost_price: number }[]
}): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/product-costs/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка массового добавления" }
    }
    return { success: true, message: result.message }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}
