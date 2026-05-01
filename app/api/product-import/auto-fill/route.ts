import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

// Proxies the AI auto-fill request to Flask, forwarding the JWT cookie.
// Backend enforces access via /admin/products/auto-fill (requires
// allowed_product_import_user_ids opt-in).
const BACKEND_ENDPOINT = "/api/admin/products/auto-fill"

export async function POST(request: NextRequest) {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  try {
    const body = await request.json()
    const response = await fetch(getApiUrl(BACKEND_ENDPOINT), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      // The backend call hits Anthropic + downloads HTML; can take ~10s.
      // Don't apply Next's default 10s timeout.
      cache: "no-store",
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying product auto-fill:", error)
    return NextResponse.json({ error: "Ошибка автозаполнения" }, { status: 500 })
  }
}
