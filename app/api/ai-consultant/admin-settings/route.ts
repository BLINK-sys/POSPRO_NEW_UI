import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

// Owner-only endpoint. Flask enforces the bocan.anton@mail.ru check and
// returns 403 to anyone else; this route is just a JWT-cookie pass-through.

const BACKEND_ENDPOINT = "/api/admin/ai-consultant/settings"

export async function GET() {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  try {
    const response = await fetch(getApiUrl(BACKEND_ENDPOINT), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying AI consultant settings GET:", error)
    return NextResponse.json({ error: "Ошибка загрузки настроек" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  try {
    const body = await request.json()
    const response = await fetch(getApiUrl(BACKEND_ENDPOINT), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying AI consultant settings PUT:", error)
    return NextResponse.json({ error: "Ошибка сохранения настроек" }, { status: 500 })
  }
}
