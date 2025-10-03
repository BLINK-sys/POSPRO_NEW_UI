"use server"

import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"
import { API_ENDPOINTS } from "@/lib/api-endpoints"

export interface Benefit {
  id: number
  title: string
  description?: string
  icon?: string
  order: number
  active: boolean
}

// Получить все преимущества
export async function getBenefits(): Promise<Benefit[]> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.ADMIN.BENEFITS.LIST), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching benefits:", error)
    throw new Error("Ошибка получения преимуществ")
  }
} 