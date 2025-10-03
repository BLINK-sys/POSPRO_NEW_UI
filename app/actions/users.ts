"use server"

import { cookies } from "next/headers"
import { revalidatePath } from "next/cache"
import { API_BASE_URL } from "@/lib/api-address"

interface ActionState {
  error?: string
  success?: boolean
  message?: string
}

export interface Client {
  id: number
  email: string
  phone: string
  delivery_address: string
  organization_type: "individual" | "ip" | "too"
  full_name?: string
  iin?: string
  ip_name?: string
  bin?: string
  too_name?: string
  is_wholesale?: boolean
  created_at: string
  updated_at: string
}

export interface SystemUser {
  id: number
  email: string
  full_name: string
  role: string
  access: Record<string, boolean>
  created_at: string
  updated_at: string
}

// Функция для получения заголовков авторизации
const getAuthHeaders = async () => {
  const cookieStore = await cookies()
  const token = cookieStore.get("jwt-token")?.value
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  }
}

// Функция для обработки ответов API
const handleApiResponse = async (response: Response, errorMessage: string) => {
  console.log(`API Response Status: ${response.status}`)
  console.log(`API Response URL: ${response.url}`)

  // Check if response is JSON
  const contentType = response.headers.get("content-type")
  if (!contentType || !contentType.includes("application/json")) {
    const textResponse = await response.text()
    console.error("Non-JSON response received:", textResponse.substring(0, 200))
    throw new Error("Сервер вернул некорректный ответ. Проверьте API эндпоинт.")
  }

  if (!response.ok) {
    let apiError = errorMessage
    try {
      const errorData = await response.json()
      apiError = errorData.message || errorMessage
    } catch (parseError) {
      console.error("Error parsing error response:", parseError)
    }
    throw new Error(apiError)
  }

  return await response.json()
}

// Функции для работы с клиентами
export async function getClients(): Promise<Client[]> {
  try {
    console.log("Fetching clients from:", `${API_BASE_URL}/api/clients`)

    const response = await fetch(`${API_BASE_URL}/api/clients`, {
      method: "GET",
      headers: await getAuthHeaders(),
      cache: "no-store",
    })

    const data = await handleApiResponse(response, "Ошибка получения списка клиентов")
    return data.clients || data || []
  } catch (error) {
    console.error("Error fetching clients:", error)
    throw new Error("Failed to fetch clients")
  }
}

export async function getWholesaleClients(): Promise<Client[]> {
  try {
    console.log("Fetching wholesale clients from:", `${API_BASE_URL}/api/clients/wholesale`)

    const response = await fetch(`${API_BASE_URL}/api/clients/wholesale`, {
      method: "GET",
      headers: await getAuthHeaders(),
      cache: "no-store",
    })

    const data = await handleApiResponse(response, "Ошибка получения списка оптовых покупателей")
    return data.clients || data || []
  } catch (error) {
    console.error("Error fetching wholesale clients:", error)
    throw new Error("Failed to fetch wholesale clients")
  }
}

export async function saveClient(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const clientData = Object.fromEntries(formData.entries())
    const clientId = clientData.id as string

    console.log("Saving client:", clientId ? "Update" : "Create", clientData)

    const url = clientId ? `${API_BASE_URL}/api/clients/${clientId}` : `${API_BASE_URL}/api/clients`

    const method = clientId ? "PUT" : "POST"

    const response = await fetch(url, {
      method,
      headers: await getAuthHeaders(),
      body: JSON.stringify(clientData),
    })

    await handleApiResponse(response, clientId ? "Ошибка обновления клиента" : "Ошибка создания клиента")

    revalidatePath("/admin/users")
    return {
      success: true,
      message: clientId ? "Клиент успешно обновлен!" : "Клиент успешно создан!",
    }
  } catch (error) {
    console.error("Error saving client:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при сохранении клиента" }
  }
}

export async function deleteClient(clientId: number): Promise<ActionState> {
  try {
    console.log("Deleting client:", clientId)

    const response = await fetch(`${API_BASE_URL}/api/clients/${clientId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    })

    await handleApiResponse(response, "Ошибка удаления клиента")

    revalidatePath("/admin/users")
    return { success: true, message: "Клиент успешно удален!" }
  } catch (error) {
    console.error("Error deleting client:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при удалении клиента" }
  }
}

// Функции для работы с системными пользователями
export async function getSystemUsers(): Promise<SystemUser[]> {
  try {
    console.log("Fetching system users from:", `${API_BASE_URL}/api/system-users`)

    const response = await fetch(`${API_BASE_URL}/api/system-users`, {
      method: "GET",
      headers: await getAuthHeaders(),
      cache: "no-store",
    })

    const data = await handleApiResponse(response, "Ошибка получения списка системных пользователей")
    return data.users || data || []
  } catch (error) {
    console.error("Error fetching system users:", error)
    throw new Error("Failed to fetch system users")
  }
}

export async function saveSystemUser(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const userData = Object.fromEntries(formData.entries())
    const userId = userData.id as string

    // Обработка доступов
    const access: Record<string, boolean> = {}
    const accessKeys = ["dashboard", "users", "products", "orders", "reports", "settings"]

    accessKeys.forEach((key) => {
      access[key] = userData[`access_${key}`] === "on"
      delete userData[`access_${key}`]
    })

    userData.access = JSON.stringify(access)

    console.log("Saving system user:", userId ? "Update" : "Create", userData)

    const url = userId ? `${API_BASE_URL}/api/system-users/${userId}` : `${API_BASE_URL}/api/system-users`

    const method = userId ? "PUT" : "POST"

    const response = await fetch(url, {
      method,
      headers: await getAuthHeaders(),
      body: JSON.stringify(userData),
    })

    await handleApiResponse(response, userId ? "Ошибка обновления пользователя" : "Ошибка создания пользователя")

    revalidatePath("/admin/users")
    return {
      success: true,
      message: userId ? "Пользователь успешно обновлен!" : "Пользователь успешно создан!",
    }
  } catch (error) {
    console.error("Error saving system user:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при сохранении пользователя" }
  }
}

export async function deleteSystemUser(userId: number): Promise<ActionState> {
  try {
    console.log("Deleting system user:", userId)

    const response = await fetch(`${API_BASE_URL}/api/system-users/${userId}`, {
      method: "DELETE",
      headers: await getAuthHeaders(),
    })

    await handleApiResponse(response, "Ошибка удаления пользователя")

    revalidatePath("/admin/users")
    return { success: true, message: "Пользователь успешно удален!" }
  } catch (error) {
    console.error("Error deleting system user:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при удалении пользователя" }
  }
}
