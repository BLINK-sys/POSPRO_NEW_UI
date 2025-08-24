"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

export interface FooterSettings {
  description: string
  instagram_url: string
  whatsapp_url: string
  telegram_url: string
  phone: string
  email: string
  address: string
  working_hours: string
}

export interface FooterSettingsActionState {
  error?: string
  success?: boolean
  message?: string
  data?: FooterSettings
}

const getToken = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

export async function getFooterSettings(): Promise<FooterSettings | null> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/api/footer-settings`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    })

    if (!res.ok) return null
    return res.json()
  } catch (e) {
    return null
  }
}

export async function saveFooterSettings(settings: FooterSettings): Promise<FooterSettingsActionState> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/api/footer-settings`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    })

    const result = await res.json()

    if (!res.ok) {
      return { error: result.message || "Ошибка сохранения настроек подвала" }
    }

    revalidatePath("/admin/pages")
    return {
      success: true,
      message: result.message || "Настройки подвала сохранены",
      data: result.data || settings,
    }
  } catch (e) {
    return { error: "Ошибка сети при сохранении настроек." }
  }
}

export async function createFooterSettings(settings: FooterSettings): Promise<FooterSettingsActionState> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/api/footer-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(settings),
    })

    const result = await res.json()

    if (!res.ok) {
      return { error: result.message || "Ошибка создания настроек подвала" }
    }

    revalidatePath("/admin/pages")
    return {
      success: true,
      message: result.message || "Настройки подвала созданы",
      data: result.data || settings,
    }
  } catch (e) {
    return { error: "Ошибка сети при создании настроек." }
  }
}
