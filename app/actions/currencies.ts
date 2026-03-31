"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

export interface Currency {
  id: number
  name: string
  code: string
  rate_to_tenge: number
  created_at: string | null
  updated_at: string | null
}

export interface CurrencyActionResponse {
  success: boolean
  message?: string
  data?: Currency
  error?: string
}

const getToken = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

export async function getCurrencies(): Promise<Currency[]> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/currencies`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    const response = await res.json()
    return response.data || []
  } catch (e) {
    console.error("Error fetching currencies:", e)
    return []
  }
}

export async function createCurrency(
  data: Omit<Currency, "id" | "created_at" | "updated_at">
): Promise<CurrencyActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/currencies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка создания валюты" }
    }
    revalidatePath("/admin/suppliers")
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function updateCurrency(
  id: number,
  data: Partial<Omit<Currency, "id" | "created_at" | "updated_at">>
): Promise<CurrencyActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/currencies/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка обновления валюты" }
    }
    revalidatePath("/admin/suppliers")
    return { success: true, message: result.message, data: result.data }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function deleteCurrency(id: number): Promise<CurrencyActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/currencies/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка удаления валюты" }
    }
    revalidatePath("/admin/suppliers")
    return { success: true, message: result.message }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}

export async function refreshRates(): Promise<{
  success: boolean
  message?: string
  updated?: Array<{ code: string; old_rate: number; new_rate: number }>
  available?: Record<string, number>
  error?: string
}> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/currencies/refresh-rate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    if (!res.ok) {
      return { success: false, error: result.message || "Ошибка обновления курсов" }
    }
    return { success: true, message: result.message, updated: result.data?.updated, available: result.data?.available }
  } catch (e) {
    return { success: false, error: "Ошибка сети" }
  }
}
