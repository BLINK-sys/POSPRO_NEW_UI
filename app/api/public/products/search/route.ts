import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

// Прокси к Flask /api/products/search. Прямой route handler нужен
// для live-search на клиенте — server-action путь не поддерживает
// AbortController (запрос на бэке доедет даже если клиент отменил),
// а на каждое нажатие клавиши шлёт новый action.
//
// Передаём cookies → Authorization Bearer чтобы бэк понимал system-юзера
// (тогда search видит скрытые товары). Для гостей просто пропускаем.
//
// Все query-параметры пробрасываются как есть: q, category_id, brand_id,
// limit, with_count.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = cookies().get("jwt-token")?.value

  try {
    const upstreamUrl = getApiUrl(`/products/search?${searchParams.toString()}`)
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // Не кешируем — каждый поиск свежий
      cache: "no-store",
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying products/search:", error)
    return NextResponse.json([], { status: 500 })
  }
}
