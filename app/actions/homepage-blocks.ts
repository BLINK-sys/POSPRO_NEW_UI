"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { getApiUrl } from "@/lib/api-address"
import { API_ENDPOINTS } from "@/lib/api-endpoints"
import { 
  HomepageBlock, 
  CreateHomepageBlockData, 
  UpdateHomepageBlockData 
} from "@/lib/constants"

interface ActionState {
  error?: string
  success?: boolean
  message?: string
}

// Получить все блоки
export async function getHomepageBlocks(): Promise<HomepageBlock[]> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Не авторизован")
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.HOMEPAGE_BLOCKS.GET_ALL), {
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
    console.error("Error fetching homepage blocks:", error)
    throw new Error("Ошибка получения блоков главной страницы")
  }
}

// Создать новый блок
export async function createHomepageBlock(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return { error: "Не авторизован" }
    }

    const data = Object.fromEntries(formData.entries())
    
    const blockData: CreateHomepageBlockData = {
      title: data.title as string,
      description: data.description as string,
      type: data.type as any,
      active: data.active === "true",
      carusel: data.carusel === "true",
      show_title: data.show_title === "true",
      title_align: data.title_align as any || "left",
      items: data.items ? JSON.parse(data.items as string) : [],
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.HOMEPAGE_BLOCKS.CREATE), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(blockData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    revalidatePath("/admin/pages")
    return { success: true, message: "Блок успешно создан!" }
  } catch (error) {
    console.error("Error creating homepage block:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при создании блока" }
  }
}

// Обновить блок
export async function updateHomepageBlock(
  blockId: number,
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return { error: "Не авторизован" }
    }

    const data = Object.fromEntries(formData.entries())
    
    const blockData: UpdateHomepageBlockData = {
      title: data.title as string,
      description: data.description as string,
      type: data.type as any,
      active: data.active === "true",
      carusel: data.carusel === "true",
      show_title: data.show_title === "true",
      title_align: data.title_align as any || "left",
      items: data.items ? JSON.parse(data.items as string) : [],
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.HOMEPAGE_BLOCKS.UPDATE(blockId)), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(blockData),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    revalidatePath("/admin/pages")
    return { success: true, message: "Блок успешно обновлен!" }
  } catch (error) {
    console.error("Error updating homepage block:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при обновлении блока" }
  }
}

// Удалить блок
export async function deleteHomepageBlock(blockId: number): Promise<ActionState> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return { error: "Не авторизован" }
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.HOMEPAGE_BLOCKS.DELETE(blockId)), {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    revalidatePath("/admin/pages")
    return { success: true, message: "Блок успешно удален!" }
  } catch (error) {
    console.error("Error deleting homepage block:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при удалении блока" }
  }
}

// Переключить активность блока
export async function toggleHomepageBlock(blockId: number): Promise<ActionState> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return { error: "Не авторизован" }
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.HOMEPAGE_BLOCKS.TOGGLE(blockId)), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    revalidatePath("/admin/pages")
    return { success: true, message: "Статус блока изменен!" }
  } catch (error) {
    console.error("Error toggling homepage block:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при изменении статуса блока" }
  }
}

// Изменить порядок блоков
export async function reorderHomepageBlocks(blocks: { id: number; order: number }[]): Promise<ActionState> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return { error: "Не авторизован" }
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.HOMEPAGE_BLOCKS.REORDER), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(blocks),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    revalidatePath("/admin/pages")
    return { success: true, message: "Порядок блоков обновлен!" }
  } catch (error) {
    console.error("Error reordering homepage blocks:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при изменении порядка блоков" }
  }
} 

// Изменить порядок элементов блока
export async function reorderHomepageBlockItems(
  blockId: number, 
  items: { id: number; order: number }[]
): Promise<ActionState> {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return { error: "Не авторизован" }
    }

    const response = await fetch(getApiUrl(API_ENDPOINTS.HOMEPAGE_BLOCKS.REORDER_ITEMS(blockId)), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(items),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`)
    }

    revalidatePath("/admin/pages")
    return { success: true, message: "Порядок элементов блока обновлен!" }
  } catch (error) {
    console.error("Error reordering homepage block items:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при изменении порядка элементов блока" }
  }
} 