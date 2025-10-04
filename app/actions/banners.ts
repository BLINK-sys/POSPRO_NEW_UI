"use server"

import { revalidatePath } from "next/cache"

import { API_BASE_URL } from "@/lib/api-address"
const API_URL = `${API_BASE_URL}/api/admin/banners`

export interface Banner {
  id: number
  title: string
  subtitle: string
  image: string
  order: number
  button_text: string
  button_link: string
  show_button: boolean
  active: boolean
}

export async function getBanners(): Promise<Banner[]> {
  try {
    const response = await fetch(API_URL, { cache: "no-store" })
    if (!response.ok) {
      throw new Error("Failed to fetch banners")
    }
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Error fetching banners:", error)
    return []
  }
}

export async function saveBanner(
  data: Partial<Omit<Banner, "order">> & { id?: number },
): Promise<{ success: boolean; message: string; banner?: Banner; error?: string }> {
  const { id, ...payload } = data
  const url = id ? `${API_URL}/${id}` : API_URL
  const method = id ? "PUT" : "POST"

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || "Failed to save banner")
    }

    revalidatePath("/admin/pages")
    return {
      success: true,
      message: result.message || `Баннер ${id ? "обновлён" : "создан"}`,
      banner: id ? { ...data, id, order: 0 } : { ...data, id: result.id, order: 0 },
    }
  } catch (error: any) {
    return { success: false, message: "Ошибка", error: error.message }
  }
}

export async function deleteBanner(id: number): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/${id}`, { method: "DELETE" })
    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.message || "Failed to delete banner")
    }
    revalidatePath("/admin/pages")
    return { success: true, message: "Баннер удалён" }
  } catch (error: any) {
    return { success: false, message: "Ошибка", error: error.message }
  }
}

export async function reorderBanners(
  orderData: { id: number; order: number }[],
): Promise<{ success: boolean; message: string; error?: string }> {
  try {
    const response = await fetch(`${API_URL}/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(orderData),
    })
    if (!response.ok) {
      const result = await response.json()
      throw new Error(result.message || "Failed to reorder banners")
    }
    return { success: true, message: "Порядок баннеров обновлён" }
  } catch (error: any) {
    return { success: false, message: "Ошибка", error: error.message }
  }
}

export async function uploadBannerImage(
  bannerId: number,
  formData: FormData,
): Promise<{ success: boolean; url?: string; message?: string; error?: string }> {
  try {
    // Добавляем banner_id в FormData
    formData.append("banner_id", String(bannerId))
    
    const response = await fetch(`${API_BASE_URL}/api/admin/upload-image`, {
      method: "POST",
      body: formData,
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || "Failed to upload image")
    }

    return {
      success: true,
      url: result.url,
      message: result.message || "Изображение загружено",
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteBannerImage(
  filename: string,
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const extractedFilename = filename.includes("/") ? filename.split("/").pop() : filename

    const response = await fetch(`${API_BASE_URL}/api/admin/images/${extractedFilename}`, {
      method: "DELETE",
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.message || "Failed to delete image")
    }

    return {
      success: true,
      message: result.message || "Изображение удалено",
    }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
