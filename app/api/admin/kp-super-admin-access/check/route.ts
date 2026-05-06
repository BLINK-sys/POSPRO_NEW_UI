import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { getApiUrl } from "@/lib/api-address"

/**
 * Прокси для гейтинга пункта «Управление КП» в админ-сайдбаре. Возвращает
 * `{ has_access, is_owner, is_super_admin }` для текущего пользователя
 * на основе его JWT и таблицы `kp_super_admin_access`.
 */
export async function GET() {
  const token = cookies().get("jwt-token")?.value
  if (!token) {
    return NextResponse.json({ has_access: false }, { status: 200 })
  }
  try {
    const res = await fetch(getApiUrl("/api/admin/kp-super-admin-access/check"), {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
    if (!res.ok) {
      return NextResponse.json({ has_access: false }, { status: 200 })
    }
    const data = await res.json()
    return NextResponse.json({
      has_access: !!(data?.is_owner || data?.is_super_admin),
      is_owner: !!data?.is_owner,
      is_super_admin: !!data?.is_super_admin,
    })
  } catch {
    return NextResponse.json({ has_access: false }, { status: 200 })
  }
}
