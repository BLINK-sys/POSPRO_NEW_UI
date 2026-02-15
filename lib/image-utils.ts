// Утилиты для работы с изображениями
import { API_BASE_URL } from './api-address'

/**
 * Получает правильный URL для изображения
 * @param url - URL изображения из базы данных (например, /uploads/brands/3/image.png)
 * @returns Полный URL для отображения изображения
 */
export const getImageUrl = (url: string | null | undefined): string => {
  if (!url || typeof url !== 'string' || url.trim() === "") {
    return "/placeholder.svg"
  }
  
  const trimmedUrl = url.trim()
  
  // Если URL уже полный (http/https), возвращаем как есть
  if (trimmedUrl.startsWith("http://") || trimmedUrl.startsWith("https://")) {
    return trimmedUrl
  }
  
  // Если URL начинается с /uploads/, добавляем префикс API сервера
  if (trimmedUrl.startsWith("/uploads/")) {
    return `${API_BASE_URL}${trimmedUrl}`
  }
  
  // Для остальных относительных ссылок также добавляем префикс
  return `${API_BASE_URL}${trimmedUrl.startsWith("/") ? trimmedUrl : `/${trimmedUrl}`}`
}

/**
 * Проверяет, является ли URL изображением
 * @param url - URL для проверки
 * @returns true, если URL указывает на изображение
 */
export const isImageUrl = (url: string | null | undefined): boolean => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return false
  }
  return true
}

/**
 * Получает URL для загрузки изображения
 * @param endpoint - API endpoint для загрузки
 * @returns Полный URL для загрузки
 */
export const getUploadUrl = (endpoint: string): string => {
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint
  return `${API_BASE_URL}/${cleanEndpoint}`
}
