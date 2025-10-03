"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

export interface Brand {
  id: number
  name: string
  country: string
  description: string
  image_url: string
}

export interface Status {
  id: number
  name: string
  background_color: string
  text_color: string
}

export interface MetaActionState {
  error?: string
  success?: boolean
  message?: string
  brand?: Brand
}

const getToken = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

// --- Brands ---
export async function getBrands(): Promise<Brand[]> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/brands`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    return res.json()
  } catch (e) {
    return []
  }
}

export async function saveBrand(payload: Partial<Brand> & { id: number | string }): Promise<MetaActionState> {
  const token = await getToken()
  const { id, ...data } = payload
  const url = `${API_BASE_URL}/meta/brands/${id}`

  try {
    const res = await fetch(url, {
      method: "PUT", // Всегда используем PUT
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    const result = await res.json()
    if (!res.ok) {
      return { error: result.message || "Ошибка сохранения бренда" }
    }
    revalidatePath("/admin/brands-and-statuses")
    return { success: true, message: "Бренд сохранен.", brand: result }
  } catch (e) {
    return { error: "Ошибка сети." }
  }
}

export async function uploadBrandImage(formData: FormData): Promise<{ url?: string; error?: string }> {
  const token = await getToken()
  const id = formData.get("id")
  const file = formData.get("file")

  if (!id || !file) {
    return { error: "ID бренда и файл обязательны." }
  }

  try {
    const res = await fetch(`${API_BASE_URL}/meta/brands/upload/${id}`, {
      method: "POST", // Используем POST
      headers: { Authorization: `Bearer ${token}` }, // Не указываем Content-Type, браузер сделает это сам для multipart/form-data
      body: formData, // Передаем FormData напрямую
    })

    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка загрузки изображения." }
    }

    const result = await res.json()
    revalidatePath("/admin/brands-and-statuses")
    return { url: result.url } // Возвращаем URL из ответа
  } catch (e) {
    return { error: "Ошибка сети при загрузке изображения." }
  }
}

export async function deleteBrand(id: number): Promise<Omit<MetaActionState, "brand">> {
  const token = await getToken()
  try {
    const res = await fetch(`${API_BASE_URL}/meta/brands/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка удаления бренда" }
    }
    revalidatePath("/admin/brands-and-statuses")
    return { success: true, message: "Бренд удален." }
  } catch (e) {
    return { error: "Ошибка сети." }
  }
}

// --- Statuses (без изменений) ---
export async function getStatuses(): Promise<Status[]> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/statuses`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    return res.json()
  } catch (e) {
    return []
  }
}

export async function saveStatus(formData: FormData): Promise<MetaActionState> {
  const token = await getToken()
  const id = formData.get("id")
  const data = {
    name: formData.get("name"),
    background_color: formData.get("background_color"),
    text_color: formData.get("text_color"),
  }

  const url = `${API_BASE_URL}/meta/statuses/${id}`

  try {
    const res = await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка сохранения статуса" }
    }
    revalidatePath("/admin/brands-and-statuses")
    return { success: true, message: "Статус успешно сохранен." }
  } catch (e) {
    return { error: "Ошибка сети." }
  }
}

export async function deleteStatus(id: number): Promise<Omit<MetaActionState, "brand">> {
  const token = await getToken()
  try {
    const res = await fetch(`${API_BASE_URL}/meta/statuses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка удаления статуса" }
    }
    revalidatePath("/admin/brands-and-statuses")
    return { success: true, message: "Статус удален." }
  } catch (e) {
    return { error: "Ошибка сети." }
  }
}
