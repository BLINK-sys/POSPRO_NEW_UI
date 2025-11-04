"use server"

import { cookies } from "next/headers"
import { API_BASE_URL } from "@/lib/api-address"

export interface Category {
  id: number
  name: string
  slug: string
  description: string | null
  image_url: string | null
  parent_id: number | null
  order: number
  show_in_menu?: boolean
  children?: Category[]
}

export interface CategoryActionState {
  error?: string
  success?: boolean
  message?: string
  category?: Category
}

const getToken = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  if (!token) throw new Error("Not authorized")
  return token
}

export async function getCategories(): Promise<Category[]> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/categories/`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return []
    const categories: Category[] = await res.json()
    const map = new Map(categories.map((cat) => [cat.id, { ...cat, children: [] }]))
    const roots: Category[] = []
    for (const category of map.values()) {
      if (category.parent_id && map.has(category.parent_id)) {
        map.get(category.parent_id)!.children.push(category)
      } else {
        roots.push(category)
      }
    }
    for (const category of map.values()) {
      if (category.children.length > 0) {
        category.children.sort((a, b) => a.order - b.order)
      }
    }
    return roots.sort((a, b) => a.order - b.order)
  } catch (e) {
    console.error("Failed to fetch categories:", e)
    return []
  }
}

export async function getCategory(id: number): Promise<Category | null> {
  try {
    const token = await getToken()
    const res = await fetch(`${API_BASE_URL}/categories/${id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) return null
    return await res.json()
  } catch (e) {
    console.error("Failed to fetch category:", e)
    return null
  }
}

// Сохраняет только текстовые данные. Для создания может принять и файл.
export async function saveCategory(formData: FormData): Promise<CategoryActionState> {
  const token = await getToken()
  const id = formData.get("id") as string | null

  const method = id ? "PUT" : "POST"
  const url = id ? `${API_BASE_URL}/categories/${id}` : `${API_BASE_URL}/categories/with-image`

  let body: BodyInit
  const headers: HeadersInit = { Authorization: `Bearer ${token}` }

  if (method === "PUT") {
    headers["Content-Type"] = "application/json"
    const parentIdValue = formData.get("parent_id") as string
    const showInMenuValue = formData.get("show_in_menu") as string
    const payload = {
      name: formData.get("name"),
      slug: formData.get("slug"),
      description: formData.get("description"),
      parent_id: parentIdValue === "0" ? null : Number(parentIdValue),
      show_in_menu: showInMenuValue === "true",
    }
    body = JSON.stringify(payload)
  } else {
    // Для POST (создание) нужно исправить parent_id перед отправкой
    const parentIdValue = formData.get("parent_id") as string
    if (parentIdValue === "0") {
      formData.delete("parent_id")
      formData.append("parent_id", "")
    }
    body = formData
  }

  try {
    const res = await fetch(url, { method, headers, body })
    const result = await res.json()
    if (!res.ok) {
      return { error: result.message || "Ошибка сохранения категории" }
    }
    return { success: true, message: "Данные категории сохранены.", category: result }
  } catch (e) {
    return { error: "Ошибка сети." }
  }
}

export async function uploadCategoryImage(categoryId: number, formData: FormData): Promise<CategoryActionState> {
  const token = getToken()
  try {
    const res = await fetch(`${API_BASE_URL}/upload/category/${categoryId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    })
    const result = await res.json()
    if (!res.ok) return { error: result.message || "Ошибка загрузки изображения" }
    return { success: true, message: "Изображение загружено." }
  } catch (e) {
    return { error: "Ошибка сети при загрузке изображения." }
  }
}

export async function deleteCategoryImage(categoryId: number): Promise<CategoryActionState> {
  const token = getToken()
  try {
    const res = await fetch(`${API_BASE_URL}/upload/category/${categoryId}/image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка удаления изображения" }
    }
    return { success: true, message: "Изображение удалено." }
  } catch (e) {
    return { error: "Ошибка сети при удалении изображения." }
  }
}

export async function setCategoryImageUrl(category: Category, imageUrl: string): Promise<CategoryActionState> {
  const token = getToken()
  try {
    const payload = {
      name: category.name,
      slug: category.slug,
      description: category.description,
      parent_id: category.parent_id,
      image_url: imageUrl,
    }

    const res = await fetch(`${API_BASE_URL}/categories/${category.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка установки URL изображения" }
    }
    return { success: true, message: "URL изображения установлен." }
  } catch (e) {
    return { error: "Ошибка сети при установке URL." }
  }
}

export async function reorderCategories(orders: { id: number; order: number }[]): Promise<CategoryActionState> {
  const token = getToken()
  try {
    const res = await fetch(`${API_BASE_URL}/categories/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(orders),
    })
    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка изменения порядка" }
    }
    return { success: true, message: "Порядок сохранен." }
  } catch (e) {
    return { error: "Ошибка сети." }
  }
}

export async function deleteCategory(id: number): Promise<CategoryActionState> {
  const token = getToken()
  try {
    const res = await fetch(`${API_BASE_URL}/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка удаления категории" }
    }
    return { success: true, message: "Категория удалена." }
  } catch (e) {
    return { error: "Ошибка сети." }
  }
}

export async function updateCategoryShowInMenu(
  categoryId: number,
  showInMenu: boolean,
): Promise<CategoryActionState> {
  const token = getToken()
  try {
    // Получаем текущую категорию для сохранения всех полей
    const categoryRes = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    
    if (!categoryRes.ok) {
      return { error: "Не удалось получить данные категории" }
    }

    const category = await categoryRes.json()
    
    // Обновляем только show_in_menu, сохраняя остальные поля
    const payload = {
      name: category.name,
      slug: category.slug,
      description: category.description || null,
      parent_id: category.parent_id,
      image_url: category.image_url || null,
      show_in_menu: showInMenu,
    }

    const res = await fetch(`${API_BASE_URL}/categories/${categoryId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const err = await res.json()
      return { error: err.message || "Ошибка обновления статуса отображения в меню" }
    }

    // PUT endpoint возвращает обновленную категорию
    const updatedCategory = await res.json()

    return {
      success: true,
      message: showInMenu ? "Категория отображается в меню" : "Категория скрыта в меню",
      category: updatedCategory,
    }
  } catch (e) {
    return { error: "Ошибка сети." }
  }
}
