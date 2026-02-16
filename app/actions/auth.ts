"use server"

import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { API_ENDPOINTS } from "@/lib/api-endpoints"
import { getApiUrl } from "@/lib/api-address"

interface ActionState {
  error?: string
  success?: boolean
  message?: string
}

export interface User {
  id: number
  email: string
  phone?: string
  organization_type?: "individual" | "ip" | "too"
  full_name?: string
  ip_name?: string
  too_name?: string
  role: string
  access?: Record<string, boolean>
  is_wholesale?: boolean
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

export async function loginAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const email = formData.get("email") as string
    const password = formData.get("password") as string

    if (!email || !password) {
      return { error: "Email и пароль обязательны" }
    }

    console.log("Attempting login to:", getApiUrl(API_ENDPOINTS.AUTH.LOGIN))

    const response = await fetch(getApiUrl(API_ENDPOINTS.AUTH.LOGIN), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    })

    const data = await handleApiResponse(response, "Ошибка авторизации")

    if (data.token) {
      // Сохраняем токен в cookies
      cookies().set("jwt-token", data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 дней
      })

      // Сохраняем информацию о пользователе
      if (data.user) {
        cookies().set("user-data", JSON.stringify(data.user), {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 7, // 7 дней
        })
      }

      return { success: true }
    }

    return { error: "Неверные учетные данные" }
  } catch (error) {
    console.error("Login Action Error:", error)
    if (error instanceof Error) {
      if (error.message.includes("<!DOCTYPE")) {
        return { error: "Сервер недоступен. Проверьте подключение к API." }
      }
      return { error: error.message }
    }
    return { error: "Произошла ошибка при входе в систему" }
  }
}

export async function registerAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const data = Object.fromEntries(formData.entries())
    
    console.log("Registration form data:", data)

    console.log("Attempting registration to:", getApiUrl(API_ENDPOINTS.AUTH.REGISTER))

    const response = await fetch(getApiUrl(API_ENDPOINTS.AUTH.REGISTER), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })

    const result = await handleApiResponse(response, "Ошибка регистрации")

    return { success: true, message: "Регистрация прошла успешно! Теперь вы можете войти в систему." }
  } catch (error) {
    console.error("Register Action Error:", error)
    if (error instanceof Error) {
      if (error.message.includes("<!DOCTYPE")) {
        return { error: "Сервер недоступен. Проверьте подключение к API." }
      }
      const msg = error.message.toLowerCase()
      if (msg.includes("already") || msg.includes("exist") || msg.includes("duplicate") || msg.includes("уже")) {
        return { error: "Этот Email уже зарегистрирован. Попробуйте войти или используйте другой Email." }
      }
      return { error: error.message }
    }
    return { error: "Произошла ошибка при регистрации" }
  }
}

export async function logoutAction() {
  try {
    const token = cookies().get("jwt-token")?.value

    if (token) {
      // Попытка выйти через API
      try {
        await fetch(getApiUrl(API_ENDPOINTS.AUTH.LOGOUT), {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
      } catch (error) {
        console.error("Logout API error:", error)
        // Продолжаем выход даже если API недоступен
      }
    }

    // Удаляем cookies
    cookies().delete("jwt-token")
    cookies().delete("user-data")

    // Не перенаправляем, пользователь остается на текущей странице
  } catch (error) {
    console.error("Logout Action Error:", error)
    // Принудительно удаляем cookies
    cookies().delete("jwt-token")
    cookies().delete("user-data")
  }
}

export async function getProfile(): Promise<User | null> {
  try {
    const token = cookies().get("jwt-token")?.value
    const userData = cookies().get("user-data")?.value

    if (!token) {
      return null
    }

    // Сначала пытаемся получить данные из cookies
    if (userData) {
      try {
        return JSON.parse(userData)
      } catch (error) {
        console.error("Error parsing user data from cookies:", error)
      }
    }

    // Если данных в cookies нет, запрашиваем с сервера
    console.log("Fetching profile from:", getApiUrl(API_ENDPOINTS.AUTH.PROFILE))

    const response = await fetch(getApiUrl(API_ENDPOINTS.AUTH.PROFILE), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    const data = await handleApiResponse(response, "Ошибка получения профиля")

    // Сохраняем данные в cookies для следующих запросов
    cookies().set("user-data", JSON.stringify(data), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 дней
    })

    return data
  } catch (error) {
    console.error("Get Profile Error:", error)
    return null
  }
}

export async function updateProfileAction(prevState: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const token = cookies().get("jwt-token")?.value
    if (!token) {
      return { error: "Вы не авторизованы." }
    }

    const data = Object.fromEntries(formData.entries())
    const payload: { [key: string]: any } = {}

    // Собираем только заполненные поля, чтобы не отправлять пустые значения
    for (const key in data) {
      if (data[key] !== "") {
        payload[key] = data[key]
      }
    }

    console.log("Updating profile at:", getApiUrl(API_ENDPOINTS.PROFILE.UPDATE))

    const response = await fetch(getApiUrl(API_ENDPOINTS.PROFILE.UPDATE), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    const result = await handleApiResponse(response, "Ошибка обновления профиля")

    // Очищаем кэш данных пользователя, чтобы при следующем запросе получить свежие данные
    cookies().delete("user-data")

    // Обновляем кэш для страницы профиля, чтобы отобразить новые данные
    revalidatePath("/profile")

    return { success: true, message: "Профиль успешно обновлен!" }
  } catch (error) {
    console.error("Update Profile Error:", error)
    if (error instanceof Error) {
      return { error: error.message }
    }
    return { error: "Произошла ошибка при обновлении профиля" }
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const token = cookies().get("jwt-token")?.value
  return !!token
}

export async function requireAuth() {
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    redirect("/auth")
  }
}

export async function getDeliveryAddress() {
  const cookieStore = cookies()
  const token = cookieStore.get('jwt-token')
  
  if (!token) {
    return { success: false, message: 'Не авторизован' }
  }

  try {
    const response = await fetch(`${getApiUrl('/api/profile/delivery-address')}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token.value}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    })

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Ошибка получения адреса доставки:', error)
    return { 
      success: false, 
      message: 'Ошибка при получении адреса доставки' 
    }
  }
}
