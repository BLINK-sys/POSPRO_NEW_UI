"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

export interface Supplier {
  id: number
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  description: string | null
}

export interface SuppliersResponse {
  success: boolean
  data: Supplier[]
  count: number
}

export interface SupplierResponse {
  success: boolean
  data: Supplier
}

export interface SupplierActionResponse {
  success: boolean
  message?: string
  data?: Supplier
  error?: string
}

const getToken = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

// Получить всех поставщиков
export async function getSuppliers(search?: string): Promise<Supplier[]> {
  try {
    const token = await getToken()
    const url = search
      ? `${API_BASE_URL}/meta/suppliers?search=${encodeURIComponent(search)}`
      : `${API_BASE_URL}/meta/suppliers`
    
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    
    if (!res.ok) {
      return []
    }
    
    const response: SuppliersResponse = await res.json()
    return response.data || []
  } catch (e) {
    console.error("Error fetching suppliers:", e)
    return []
  }
}

// Получить поставщика по ID
export async function getSupplierById(id: number): Promise<Supplier | null> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/suppliers/${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    
    if (!res.ok) {
      return null
    }
    
    const response: SupplierResponse = await res.json()
    return response.data || null
  } catch (e) {
    console.error("Error fetching supplier:", e)
    return null
  }
}

// Создать поставщика
export async function createSupplier(data: Omit<Supplier, "id">): Promise<SupplierActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/suppliers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    
    const result = await res.json()
    
    if (!res.ok) {
      return {
        success: false,
        error: result.message || "Ошибка создания поставщика",
      }
    }
    
    revalidatePath("/admin/suppliers")
    return {
      success: true,
      message: result.message || "Поставщик успешно создан",
      data: result.data,
    }
  } catch (e) {
    return {
      success: false,
      error: "Ошибка сети при создании поставщика",
    }
  }
}

// Обновить поставщика
export async function updateSupplier(
  id: number,
  data: Partial<Omit<Supplier, "id">>
): Promise<SupplierActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/suppliers/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })
    
    const result = await res.json()
    
    if (!res.ok) {
      return {
        success: false,
        error: result.message || "Ошибка обновления поставщика",
      }
    }
    
    revalidatePath("/admin/suppliers")
    return {
      success: true,
      message: result.message || "Поставщик успешно обновлен",
      data: result.data,
    }
  } catch (e) {
    return {
      success: false,
      error: "Ошибка сети при обновлении поставщика",
    }
  }
}

// Удалить поставщика
export async function deleteSupplier(id: number): Promise<SupplierActionResponse> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/meta/suppliers/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    
    const result = await res.json()
    
    if (!res.ok) {
      return {
        success: false,
        error: result.message || "Ошибка удаления поставщика",
      }
    }
    
    revalidatePath("/admin/suppliers")
    return {
      success: true,
      message: result.message || "Поставщик успешно удален",
    }
  } catch (e) {
    return {
      success: false,
      error: "Ошибка сети при удалении поставщика",
    }
  }
}

