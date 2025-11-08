import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"
import { API_ENDPOINTS } from "@/lib/api-endpoints"

export async function GET(request: NextRequest) {
  const token = cookies().get("jwt-token")?.value

  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }

  const backendUrl = new URL(getApiUrl(API_ENDPOINTS.PRODUCTS.LIST))

  request.nextUrl.searchParams.forEach((value, key) => {
    if (value !== undefined && value !== null) {
      backendUrl.searchParams.append(key, value)
    }
  })

  try {
    const response = await fetch(backendUrl.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })

    const text = await response.text()
    let data: any = null
    if (text) {
      try {
        data = JSON.parse(text)
      } catch {
        data = { message: text }
      }
    }

    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying admin products request:", error)
    return NextResponse.json({ error: "Ошибка получения товаров" }, { status: 500 })
  }
}

