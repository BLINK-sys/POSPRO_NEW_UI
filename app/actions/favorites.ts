"use server"

import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

export interface FavoriteProduct {
  id: number
  name: string
  slug: string
  price: number
  article: string
  image_url?: string
  quantity?: number
  status?: {
    id: number
    name: string
    background_color: string
    text_color: string
  }
  availability_status?: {
    status_name: string
    background_color: string
    text_color: string
  } | null
  brand_id?: number | null
  brand_info?: {
    id: number
    name: string
    country?: string
    description?: string
    image_url?: string
  } | null
  category?: {
    id: number
    name: string
    slug: string
  }
}

export interface Favorite {
  id: number
  product: FavoriteProduct
  created_at: string
}

export interface FavoritesResponse {
  success: boolean
  favorites: Favorite[]
  count: number
  message?: string
}

export interface FavoriteActionResponse {
  success: boolean
  message: string
  is_favorite?: boolean
  favorite?: Favorite
}

/**
 * Получить список избранных товаров пользователя
 */
export async function getFavorites(): Promise<Favorite[]> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      throw new Error("Требуется авторизация")
    }

    const response = await fetch(getApiUrl("/api/favorites"), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const data: FavoritesResponse = await response.json()
    
    if (!data.success) {
      throw new Error(data.message || "Ошибка при получении избранного")
    }

    return data.favorites || []
  } catch (error) {
    console.error("Ошибка при получении избранного:", error)
    return []
  }
}

/**
 * Добавить товар в избранное
 */
export async function addToFavorites(productId: number): Promise<FavoriteActionResponse> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        message: "Требуется авторизация"
      }
    }

    const response = await fetch(getApiUrl("/api/favorites"), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ product_id: productId })
    })

    const data = await response.json()
    
    if (!response.ok) {
      return {
        success: false,
        message: data.message || `HTTP ${response.status}`
      }
    }

    return {
      success: data.success,
      message: data.message,
      favorite: data.favorite
    }
  } catch (error) {
    console.error("Ошибка при добавлении в избранное:", error)
    return {
      success: false,
      message: "Произошла ошибка при добавлении товара в избранное"
    }
  }
}

/**
 * Удалить товар из избранного
 */
export async function removeFromFavorites(productId: number): Promise<FavoriteActionResponse> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        message: "Требуется авторизация"
      }
    }

    const response = await fetch(getApiUrl(`/api/favorites/${productId}`), {
      method: "DELETE",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    })

    const data = await response.json()
    
    if (!response.ok) {
      return {
        success: false,
        message: data.message || `HTTP ${response.status}`
      }
    }

    return {
      success: data.success,
      message: data.message
    }
  } catch (error) {
    console.error("Ошибка при удалении из избранного:", error)
    return {
      success: false,
      message: "Произошла ошибка при удалении товара из избранного"
    }
  }
}

/**
 * Переключить статус избранного (добавить/удалить)
 */
export async function toggleFavorite(productId: number): Promise<FavoriteActionResponse> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        message: "Требуется авторизация"
      }
    }

    const response = await fetch(getApiUrl("/api/favorites/toggle"), {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ product_id: productId })
    })

    const data = await response.json()
    
    if (!response.ok) {
      return {
        success: false,
        message: data.message || `HTTP ${response.status}`
      }
    }

    return {
      success: data.success,
      message: data.message,
      is_favorite: data.is_favorite,
      favorite: data.favorite
    }
  } catch (error) {
    console.error("Ошибка при переключении избранного:", error)
    return {
      success: false,
      message: "Произошла ошибка при изменении статуса избранного"
    }
  }
}

/**
 * Проверить, находится ли товар в избранном
 */
export async function checkFavoriteStatus(productId: number): Promise<{ success: boolean; is_favorite: boolean; message?: string }> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        is_favorite: false,
        message: "Требуется авторизация"
      }
    }

    const response = await fetch(getApiUrl(`/api/favorites/check/${productId}`), {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      cache: "no-store"
    })

    const data = await response.json()
    
    if (!response.ok) {
      return {
        success: false,
        is_favorite: false,
        message: data.message || `HTTP ${response.status}`
      }
    }

    return {
      success: data.success,
      is_favorite: data.is_favorite
    }
  } catch (error) {
    console.error("Ошибка при проверке статуса избранного:", error)
    return {
      success: false,
      is_favorite: false,
      message: "Произошла ошибка при проверке статуса избранного"
    }
  }
}
