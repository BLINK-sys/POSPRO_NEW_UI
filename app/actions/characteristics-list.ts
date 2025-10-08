"use server"

import { cookies } from "next/headers"
import { API_BASE_URL } from "@/lib/api-address"

export interface CharacteristicsListItem {
  id: number
  characteristic_key: string
  unit_of_measurement?: string
}

export interface CharacteristicsListResponse {
  success: boolean
  data?: CharacteristicsListItem[]
  message?: string
}

export interface CharacteristicsListSingleResponse {
  success: boolean
  data?: CharacteristicsListItem
  message?: string
}

// Получить список всех характеристик
export async function getCharacteristicsList(): Promise<CharacteristicsListResponse> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        message: 'Не авторизован'
      }
    }

    const response = await fetch(`${API_BASE_URL}/characteristics-list?t=${Date.now()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching characteristics list:', error)
    return {
      success: false,
      message: 'Ошибка при загрузке справочника характеристик'
    }
  }
}

// Получить характеристику по ID
export async function getCharacteristicById(id: number): Promise<CharacteristicsListSingleResponse> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        message: 'Не авторизован'
      }
    }

    const response = await fetch(`${API_BASE_URL}/characteristics-list/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching characteristic:', error)
    return {
      success: false,
      message: 'Ошибка при загрузке характеристики'
    }
  }
}

// Создать новую характеристику
export async function createCharacteristic(data: {
  characteristic_key: string
  unit_of_measurement?: string
}): Promise<CharacteristicsListSingleResponse> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        message: 'Не авторизован'
      }
    }

    const response = await fetch(`${API_BASE_URL}/characteristics-list`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error creating characteristic:', error)
    return {
      success: false,
      message: 'Ошибка при создании характеристики'
    }
  }
}

// Обновить характеристику
export async function updateCharacteristic(id: number, data: {
  characteristic_key: string
  unit_of_measurement?: string
}): Promise<CharacteristicsListSingleResponse> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        message: 'Не авторизован'
      }
    }

    const response = await fetch(`${API_BASE_URL}/characteristics-list/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error updating characteristic:', error)
    return {
      success: false,
      message: 'Ошибка при обновлении характеристики'
    }
  }
}

// Удалить характеристику
export async function deleteCharacteristic(id: number): Promise<{ success: boolean; message?: string }> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get("jwt-token")?.value

    if (!token) {
      return {
        success: false,
        message: 'Не авторизован'
      }
    }

    const response = await fetch(`${API_BASE_URL}/characteristics-list/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Error deleting characteristic:', error)
    return {
      success: false,
      message: 'Ошибка при удалении характеристики'
    }
  }
}
