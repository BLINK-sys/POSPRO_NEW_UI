"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { getApiUrl } from "@/lib/api-address"
import { API_ENDPOINTS } from "@/lib/api-endpoints"

export interface SmallBanner {
  id: number
  title: string
  description: string
  image_url: string
  background_image_url?: string  // ✅ Добавлено поле фонового изображения
  title_text_color?: string  // ✅ Цвет текста заголовка
  description_text_color?: string  // ✅ Цвет текста описания
  button_text: string
  button_text_color: string
  button_bg_color: string
  button_link: string
  card_bg_color: string
  show_button: boolean
  order: number
}

export async function getSmallBanners(): Promise<SmallBanner[]> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.ADMIN.SMALL_BANNERS.LIST), {
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
    console.error("Error fetching small banners:", error)
    return []
  }
}

export async function saveSmallBanner(
  data: Partial<Omit<SmallBanner, "order">> & { id?: number },
): Promise<{ success: boolean; message: string; banner?: SmallBanner; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const { id, ...payload } = data
    const url = id 
      ? getApiUrl(API_ENDPOINTS.ADMIN.SMALL_BANNERS.UPDATE(id))
      : getApiUrl(API_ENDPOINTS.ADMIN.SMALL_BANNERS.CREATE)
    const method = id ? "PUT" : "POST"

    const response = await fetch(url, {
      method,
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || "Failed to save small banner")
    }

    revalidatePath("/admin/pages")
    return {
      success: true,
      message: result.message || `Карточка ${id ? "обновлена" : "создана"}`,
      banner: id ? { ...data, id, order: 0 } as SmallBanner : { ...data, id: result.id, order: 0 } as SmallBanner,
    }
  } catch (error: any) {
    return { success: false, message: "Ошибка", error: error.message }
  }
}

export async function deleteSmallBanner(id: number): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.ADMIN.SMALL_BANNERS.DELETE(id)), { 
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.message || "Failed to delete small banner")
    }
    revalidatePath("/admin/pages")
    return { success: true, message: "Карточка удалена" }
  } catch (error: any) {
    return { success: false, message: "Ошибка", error: error.message }
  }
}

export async function reorderSmallBanners(
  orderData: { id: number; order: number }[],
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl("/api/admin/small-banners/reorder"), {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(orderData),
    })
    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.message || "Failed to reorder small banners")
    }
    return { success: true, message: "Порядок карточек обновлён" }
  } catch (error: any) {
    return { success: false, message: "Ошибка", error: error.message }
  }
}

export async function uploadSmallBannerImage(
  file: File,
): Promise<{ success: boolean; url?: string; message?: string; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch(getApiUrl("/api/admin/small-banners/upload"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || "Failed to upload image")
    }

    return { success: true, url: result.url, message: "Изображение загружено" }
  } catch (error: any) {
    return { success: false, message: "Ошибка", error: error.message }
  }
}

export async function deleteSmallBannerImage(
  image_url: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl("/api/admin/small-banners/delete-image"), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ image_url }),
    })

    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.message || "Failed to delete image")
    }

    return { success: true, message: "Изображение удалено" }
  } catch (error: any) {
    return { success: false, message: "Ошибка", error: error.message }
  }
}
