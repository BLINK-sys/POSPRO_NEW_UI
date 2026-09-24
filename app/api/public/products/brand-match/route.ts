import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

/**
 * Прокси к Flask /products/brand-match. Отдаёт бренды, чьё имя exact
 * или префикс-совпадает с ?q=<query>. Фронт (header-search, страница
 * поиска) поверх обычного списка товаров рисует «Открыть бренд X →»,
 * когда q совпадает с именем бренда.
 *
 * Cookie → Bearer нужен только чтобы для system-юзера учитывать в
 * `product_count` и скрытые товары; для гостей просто пропускаем.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token = cookies().get("jwt-token")?.value

  try {
    const upstreamUrl = getApiUrl(`/products/brand-match?${searchParams.toString()}`)
    const response = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    })
    const data = await response.json()
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    console.error("Error proxying products/brand-match:", error)
    return NextResponse.json({ brands: [] }, { status: 500 })
  }
}
