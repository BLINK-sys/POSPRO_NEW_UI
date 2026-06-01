import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

/**
 * Прокси GET /api/admin/system-users/presence — owner-only список
 * системных пользователей с last_seen и is_online. Дёргается со страницы
 * /admin/user-activity (автообновление раз в 30 сек).
 */
export async function GET() {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 })
  }
  try {
    const res = await fetch(getApiUrl("/api/admin/system-users/presence"), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (e) {
    return NextResponse.json({ error: "Ошибка загрузки" }, { status: 500 })
  }
}
