import { NextResponse } from "next/server"
import { getApiUrl } from "@/lib/api-address"

// Прокси к Flask /api/public/search-page. Простой route handler
// (без server action) — публичный эндпоинт, авторизации не нужно.
// Раньше пробовали через server action + unstable_cache, но та цепочка
// в Next.js 14 непредсказуемо зависала, не резолвя promise.
export async function GET() {
  try {
    const response = await fetch(getApiUrl("/api/public/search-page"), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying search-page:", error)
    return NextResponse.json(
      {
        settings: { categories_enabled: false, brands_enabled: false },
        categories: [],
        brands: [],
      },
      { status: 200 },
    )
  }
}
